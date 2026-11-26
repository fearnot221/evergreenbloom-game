import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { prizes, prizeTiers, stampSpots } from '../src/data/stamps.ts';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const date = () => new Date().toISOString();
const MAX_PHOTO = 3 * 1024 * 1024;
/** 每個拍照關卡最多選出幾張佳作（發市集餐券）。 */
const PICKS_PER_SPOT = 3;
const SESSION_AGE = 7 * 24 * 60 * 60;
const COOKIE = 'songying-session';
const OAUTH_COOKIE = 'songying-oauth';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
/** Where a Google sign-in may return to: the stamp book or staff page, with its query. */
const RETURN_PATH = /^\/(?:game|staff)?(?:\?[\w=&%.~-]{0,300})?$/;
const PUBLIC_SPOTS = new Set(stampSpots.map((spot) => spot.id));
// Server-only answers. Quiz: the correct option's index. Fill: accepted text, compared
// after normalize(); a reply that contains it ("陳其寬校友") also counts.
const QUIZ = { 'zhongda-road': 0, 'main-library': 1, baihua: 2, 'csrsr-station': 1, taichi: 2 };
const FILL = { 'chungcheng-library': ['陳其寬'], auditorium: ['松果'] };
const normalize = (value) =>
  String(value)
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase();
const fillMatches = (id, value) => {
  if (typeof value !== 'string' || value.length > 40) return false;
  const reply = normalize(value);
  return FILL[id].some(
    // Room for a short sentence around the answer, not for a list of guesses.
    (answer) => reply.includes(normalize(answer)) && reply.length <= answer.length + 16,
  );
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
function username(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(value.trim()))
    fail(400, '帳號須為 3 至 32 個英文字母、數字、點、底線或連字號。');
  return value.trim().toLowerCase();
}
/** A display name the player chooses; '' clears it back to the account name. */
function nickname(value) {
  if (typeof value !== 'string') fail(400, '暱稱格式錯誤。');
  const name = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if ([...name].length > 20 || /\p{C}/u.test(name)) fail(400, '暱稱最多 20 個字，不能含控制字元。');
  return name || null;
}
/** A Google sign-in keeps its random placeholder name until the player picks one. */
const GOOGLE_PLACEHOLDER = /^g-[0-9a-f]{10}$/;
const needsSetup = (user) => user.password_hash === '!' && GOOGLE_PLACEHOLDER.test(user.username);
function imageType(bytes) {
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  fail(415, '請上傳 JPEG、PNG 或 WebP 照片。');
}
async function body(req, limit) {
  if (Number(req.headers['content-length']) > limit) fail(413, '上傳內容超過大小限制。');
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        chunks.length = 0;
        reject(new HttpError(413, '上傳內容超過大小限制。'));
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(new HttpError(400, '上傳已中斷。')));
  });
}
async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    fail(415, '請使用 JSON 請求。');
  try {
    const data = JSON.parse((await body(req, 4096)).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, '資料格式錯誤。');
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, '資料格式錯誤。');
  }
}

export async function createApp({
  database,
  origin,
  // The Google account that picked this ID administers the staff list.
  adminUsername,
  stampKeys,
  staticDir = 'dist',
  // Behind a reverse proxy every request comes from the proxy; the client's address is
  // then the last X-Forwarded-For entry, which our own proxy appended.
  trustProxy = false,
  // Days to keep photos the organisers did not pick; 0 keeps them (date not yet set).
  photoRetentionDays = 0,
  // Google sign-in is on only when both are set (OAuth web client, redirect URI
  // <origin>/api/auth/google/callback).
  googleClientId = '',
  googleClientSecret = '',
}) {
  const publicOrigin = new URL(origin);
  if (
    !['http:', 'https:'].includes(publicOrigin.protocol) ||
    publicOrigin.origin !== origin ||
    (publicOrigin.protocol === 'http:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(publicOrigin.hostname))
  )
    throw new Error('APP_ORIGIN must be an HTTPS origin, or HTTP localhost for development');
  const adminName = username(adminUsername);
  const keys = Object.values(stampKeys ?? {});
  if (
    keys.length !== PUBLIC_SPOTS.size ||
    [...PUBLIC_SPOTS].some((id) => typeof stampKeys[id] !== 'string') ||
    keys.some((key) => !/^[A-Z0-9-]{16,80}$/.test(key) || /REPLACE|CHANGE|EXAMPLE/.test(key)) ||
    new Set(keys).size !== keys.length
  )
    throw new Error(
      'STAMP_KEYS must contain a unique uppercase secret (16-80 characters) for every spot',
    );

  const db = new DatabaseSync(database);
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 3) throw new Error('Database schema is newer than this server');
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('player','staff')), redeem_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)",
      'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL)',
      'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
      'CREATE TABLE IF NOT EXISTS stamps (user_id TEXT NOT NULL REFERENCES users(id), spot_id TEXT NOT NULL, earned_at TEXT NOT NULL, method TEXT NOT NULL, PRIMARY KEY(user_id,spot_id))',
    ].join(';'),
  );
  // v2 (2026-11-12): v1 photos were consented for stamp review only, so that table and
  // its images are dropped; v2 keeps photos for the organisers' best-photo selection.
  // One redemption per account becomes one per prize tier; v1 receipts are kept,
  // read-only, as redemptions_v1.
  if (version === 1)
    db.exec(
      'BEGIN; DROP TABLE IF EXISTS photos; ALTER TABLE redemptions RENAME TO redemptions_v1; COMMIT',
    );
  // v3 also adds a player-chosen nickname, separate from the login username.
  if (!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name='nickname'").get())
    db.exec('ALTER TABLE users ADD COLUMN nickname TEXT');
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS redemptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tier TEXT NOT NULL CHECK(tier IN ('meal','merch')), redeemed_at TEXT NOT NULL, reviewer TEXT NOT NULL, stamp_count INTEGER NOT NULL, UNIQUE(user_id,tier))",
      'CREATE INDEX IF NOT EXISTS redemptions_tier ON redemptions(tier)',
      'CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), spot_id TEXT NOT NULL, image BLOB NOT NULL, mime TEXT NOT NULL, consent_at TEXT NOT NULL, submitted_at TEXT NOT NULL, picked_at TEXT, picked_by TEXT, UNIQUE(user_id,spot_id))',
      'CREATE INDEX IF NOT EXISTS photos_spot ON photos(spot_id,submitted_at)',
      // v3 (2026-11-26): external sign-in. One row per provider subject; only the stable
      // subject is kept, never the email or name.
      'CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(provider,subject))',
      'PRAGMA user_version=3',
    ].join(';'),
  );
  const transaction = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  // Password sign-in is gone: sessions of old password accounts end now.
  db.prepare(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE password_hash<>'!')",
  ).run();
  const isAdmin = (user) => user.username === adminName && user.password_hash === '!';
  const roleOf = (user) => (isAdmin(user) ? 'staff' : user.role);
  const expirePhotos = () => {
    if (photoRetentionDays > 0)
      db.prepare('DELETE FROM photos WHERE picked_at IS NULL AND submitted_at<?').run(
        new Date(Date.now() - photoRetentionDays * 86400000).toISOString(),
      );
  };
  expirePhotos();
  const expiry = setInterval(expirePhotos, 60 * 60 * 1000);
  expiry.unref();
  const root = path.resolve(staticDir);
  const buckets = new Map();
  const limited = (key, limit) => {
    const now = Date.now();
    if (buckets.size >= 10000) {
      for (const [name, bucket] of buckets) if (bucket.until <= now) buckets.delete(name);
      if (buckets.size >= 10000 && !buckets.has(key)) fail(429, '目前流量較高，請稍後再試。');
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) {
      bucket = { count: 0, until: now + 60000 };
      buckets.set(key, bucket);
    }
    if (++bucket.count > limit) fail(429, '操作太頻繁，請稍後再試。');
  };
  const cookie = (value, maxAge = SESSION_AGE) =>
    COOKIE +
    '=' +
    value +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
    maxAge +
    (publicOrigin.protocol === 'https:' ? '; Secure' : '');
  const sessionToken = (req) => {
    const raw = (req.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    return raw && /^[\w-]{43}$/.test(raw) ? sha(raw) : '';
  };
  const userFor = (req) => {
    const user = db
      .prepare(
        'SELECT users.*, sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?',
      )
      .get(sessionToken(req), Date.now());
    if (!user) fail(401, '請先登入。');
    return user;
  };
  const staffFor = (req) => {
    const user = userFor(req);
    if (roleOf(user) !== 'staff') fail(403, '此功能只開放工作人員使用。');
    return user;
  };
  const issueSession = (res, id) => {
    const raw = token();
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      sha(raw),
      id,
      Date.now() + SESSION_AGE * 1000,
    );
    res.setHeader('Set-Cookie', cookie(raw));
  };
  const playerFor = (req) => {
    const user = userFor(req);
    if (roleOf(user) !== 'player') fail(403, '工作人員帳號不參加集章兌獎。');
    if (needsSetup(user)) fail(403, '請先設定帳號 ID 與暱稱。');
    return user;
  };
  /** Stamps that count: only spots that exist now (renamed spots no longer count). */
  const stampCount = (id) =>
    db
      .prepare('SELECT spot_id FROM stamps WHERE user_id=?')
      .all(id)
      .filter((row) => PUBLIC_SPOTS.has(row.spot_id)).length;
  const left = (tier) =>
    prizes[tier].stock -
    db.prepare('SELECT count(*) AS n FROM redemptions WHERE tier=?').get(tier).n;
  const prizeView = (user, count) =>
    Object.fromEntries(
      prizeTiers.map((tier) => [
        tier,
        {
          eligible: count >= prizes[tier].need,
          left: Math.max(0, left(tier)),
          redemption:
            db
              .prepare('SELECT id,redeemed_at,reviewer FROM redemptions WHERE user_id=? AND tier=?')
              .get(user.id, tier) ?? null,
        },
      ]),
    );
  const pickedSpots = (id) =>
    db
      .prepare('SELECT spot_id FROM photos WHERE user_id=? AND picked_at IS NOT NULL')
      .all(id)
      .map((row) => row.spot_id);
  const view = (user) => {
    const count = stampCount(user.id);
    return {
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: roleOf(user),
        admin: isAdmin(user),
        setup: needsSetup(user),
      },
      stamps: Object.fromEntries(
        db
          .prepare('SELECT spot_id,earned_at FROM stamps WHERE user_id=?')
          .all(user.id)
          .filter((row) => PUBLIC_SPOTS.has(row.spot_id))
          .map((row) => [row.spot_id, row.earned_at]),
      ),
      // Shown once there is anything to collect: a prize tier, or a picked photo.
      redeemCode:
        roleOf(user) === 'player' &&
        (count >= Math.min(...prizeTiers.map((t) => prizes[t].need)) ||
          pickedSpots(user.id).length > 0)
          ? user.redeem_code
          : null,
      prizes: prizeView(user, count),
      // Which of this player's photos the organisers picked (a market meal voucher each).
      photos: Object.fromEntries(
        db
          .prepare('SELECT spot_id,picked_at FROM photos WHERE user_id=?')
          .all(user.id)
          .map((row) => [row.spot_id, { picked: row.picked_at !== null }]),
      ),
    };
  };
  const writeStamp = (id, spot) =>
    db
      .prepare('INSERT INTO stamps VALUES (?,?,?,?) ON CONFLICT(user_id,spot_id) DO NOTHING')
      .run(id, spot.id, date(), spot.method);
  const claimSpot = (key, id) => {
    if (typeof key !== 'string' || key.length > 80) fail(400, '集章點代碼無效。');
    const normalized = key.trim().toUpperCase();
    const spot = stampSpots.find((item) => sha(stampKeys[item.id]) === sha(normalized));
    if (!spot || (id && spot.id !== id)) fail(400, '集章點代碼無效。');
    return spot;
  };
  const send = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json;charset=utf-8' });
    res.end(JSON.stringify(value));
  };
  const google = Boolean(googleClientId && googleClientSecret);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const oauthCookie = (value, maxAge) =>
    `${OAUTH_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${publicOrigin.protocol === 'https:' ? '; Secure' : ''}`;
  const redirect = (res, location) => {
    res.writeHead(303, { Location: location });
    res.end();
  };
  /** Exchange the code at Google's token endpoint and return the account's subject. */
  const googleSubject = async (code, verifier) => {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) fail(502, 'Google 登入失敗，請再試一次。');
    const idToken = (await response.json()).id_token;
    // The ID token came straight from Google over TLS in exchange for our code, so its
    // claims are checked without a signature check (OpenID Connect Core 3.1.3.7).
    let claims;
    try {
      claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    } catch {
      fail(502, 'Google 登入失敗，請再試一次。');
    }
    if (
      !GOOGLE_ISSUERS.includes(claims.iss) ||
      claims.aud !== googleClientId ||
      !(claims.exp * 1000 > Date.now()) ||
      typeof claims.sub !== 'string' ||
      !/^\w{1,255}$/.test(claims.sub)
    )
      fail(502, 'Google 登入失敗，請再試一次。');
    return claims.sub;
  };
  async function api(req, res, url) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'POST' && req.headers.origin !== origin) fail(403, '請從集章頁面送出操作。');
    const ip =
      (trustProxy && req.headers['x-forwarded-for']?.split(',').at(-1)?.trim()) ||
      req.socket.remoteAddress;
    // Per address: generous, since campus Wi-Fi puts many players behind one IP. The
    // per-username limit on login is what stops password guessing.
    if (url.pathname === '/api/auth/providers' && req.method === 'GET')
      return send(res, 200, { google });
    if (url.pathname === '/api/auth/google' && req.method === 'GET') {
      if (!google) fail(404, '尚未開放 Google 登入。');
      limited(`auth:${ip}`, 300);
      const next = url.searchParams.get('next') ?? '/';
      const state = token();
      const verifier = token();
      res.setHeader(
        'Set-Cookie',
        oauthCookie(
          `${state}.${verifier}.${Buffer.from(RETURN_PATH.test(next) ? next : '/').toString('base64url')}`,
          600,
        ),
      );
      return redirect(
        res,
        `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
          client_id: googleClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid',
          state,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          code_challenge_method: 'S256',
          prompt: 'select_account',
        })}`,
      );
    }
    if (url.pathname === '/api/auth/google/callback' && req.method === 'GET') {
      if (!google) fail(404, '尚未開放 Google 登入。');
      limited(`auth:${ip}`, 300);
      const saved = (req.headers.cookie ?? '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${OAUTH_COOKIE}=`))
        ?.slice(OAUTH_COOKIE.length + 1)
        .split('.');
      res.setHeader('Set-Cookie', oauthCookie('', 0));
      const [state, verifier, packed] = saved ?? [];
      const value = Buffer.from(packed ?? '', 'base64url').toString('utf8');
      const next = RETURN_PATH.test(value) ? value : '/';
      const back = (error) =>
        redirect(res, `${next}${next.includes('?') ? '&' : '?'}login=${error}`);
      const code = url.searchParams.get('code');
      if (
        !state ||
        !verifier ||
        !code ||
        code.length > 2048 ||
        sha(url.searchParams.get('state') ?? '') !== sha(state)
      )
        return back(url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'failed');
      let subject;
      try {
        subject = await googleSubject(code, verifier);
      } catch (error) {
        if (!error.status) console.error('Google sign-in failed:', error.code ?? error.name);
        return back('failed');
      }
      const id = transaction(() => {
        const found = db
          .prepare("SELECT user_id FROM identities WHERE provider='google' AND subject=?")
          .get(subject);
        if (found) return found.user_id;
        // A new player with a random name; the Google account's email is not stored.
        const fresh = randomUUID();
        let name;
        do name = `g-${randomBytes(5).toString('hex')}`;
        while (db.prepare('SELECT 1 FROM users WHERE username=?').get(name));
        db.prepare(
          'INSERT INTO users (id,username,password_hash,role,redeem_code,created_at) VALUES (?,?,?,?,?,?)',
        ).run(fresh, name, '!', 'player', randomBytes(12).toString('hex').toUpperCase(), date());
        db.prepare("INSERT INTO identities VALUES ('google',?,?,?)").run(subject, fresh, date());
        return fresh;
      });
      issueSession(res, id);
      // Keep clearing the one-time OAuth state alongside the new session cookie.
      res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), oauthCookie('', 0)]);
      return redirect(res, next);
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      await jsonBody(req);
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sessionToken(req));
      res.setHeader('Set-Cookie', cookie('', 0));
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/me' && req.method === 'GET')
      return send(res, 200, view(userFor(req)));
    if (url.pathname === '/api/nickname' && req.method === 'POST') {
      const user = userFor(req);
      limited(`nickname:${user.id}`, 20);
      const name = nickname((await jsonBody(req)).nickname);
      db.prepare('UPDATE users SET nickname=? WHERE id=?').run(name, user.id);
      return send(res, 200, view({ ...user, nickname: name }));
    }
    if (url.pathname === '/api/profile' && req.method === 'POST') {
      const user = userFor(req);
      limited(`nickname:${user.id}`, 20);
      if (!needsSetup(user)) fail(409, '帳號 ID 已設定，不能再更改。');
      const input = await jsonBody(req);
      // Stricter than password-account names; it also rules out the g-… placeholder.
      if (typeof input.username !== 'string' || !/^[a-z0-9]{8,16}$/i.test(input.username.trim()))
        fail(400, '帳號 ID 須為 8 至 16 個英文字母或數字。');
      const name = input.username.trim().toLowerCase();
      const nick = nickname(input.nickname);
      if (!nick) fail(400, '請輸入暱稱。');
      transaction(() => {
        if (db.prepare('SELECT 1 FROM users WHERE username=?').get(name))
          fail(409, '此帳號已有人使用。');
        db.prepare('UPDATE users SET username=?, nickname=? WHERE id=?').run(name, nick, user.id);
      });
      return send(res, 200, view(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)));
    }
    if (url.pathname === '/api/resolve' && req.method === 'POST') {
      const user = playerFor(req);
      limited(`claim:${user.id}`, 60);
      const input = await jsonBody(req);
      return send(res, 200, { spot: claimSpot(input.key).id });
    }
    const claim = url.pathname.match(/^\/api\/claims\/([a-z-]+)$/);
    if (claim && req.method === 'POST') {
      const user = playerFor(req);
      limited(`claim:${user.id}`, 60);
      const input = await jsonBody(req);
      const spot = claimSpot(input.key, claim[1]);
      if (spot.method === 'photo') fail(400, '拍照任務請上傳照片。');
      if (spot.method === 'quiz' && input.answer !== QUIZ[spot.id])
        fail(400, '答錯了，再想想看，重新作答一次。');
      if (spot.method === 'fill' && !fillMatches(spot.id, input.answer))
        fail(400, '答案不對喔。可以回上一步重看說明，再作答一次。');
      writeStamp(user.id, spot);
      return send(res, 200, view(user));
    }
    // Photo task: the upload completes the stamp at once (no review gate) and is kept,
    // with consent, only for the organisers' best-photo selection.
    const upload = url.pathname.match(/^\/api\/claims\/([a-z-]+)\/photo$/);
    if (upload && req.method === 'POST') {
      const user = playerFor(req);
      limited(`claim:${user.id}`, 20);
      const spot = claimSpot(req.headers['x-stamp-key'], upload[1]);
      if (spot.method !== 'photo') fail(400, '這個集章點不是拍照任務。');
      if (req.headers['x-photo-consent'] !== 'yes') fail(400, '請先同意照片的保存與使用方式。');
      const stamped = () =>
        db.prepare('SELECT 1 FROM stamps WHERE user_id=? AND spot_id=?').get(user.id, spot.id);
      if (stamped()) fail(409, '這個章已完成。');
      const bytes = await body(req, MAX_PHOTO);
      const mime = imageType(bytes);
      if (req.headers['content-type'] !== mime) fail(415, '照片格式與內容不符。');
      transaction(() => {
        if (stamped()) fail(409, '這個章已完成。');
        const now = date();
        db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?,?,NULL,NULL)').run(
          randomUUID(),
          user.id,
          spot.id,
          bytes,
          mime,
          now,
          now,
        );
        writeStamp(user.id, spot);
      });
      return send(res, 200, view(user));
    }
    if (url.pathname === '/api/admin/staff') {
      const admin = userFor(req);
      if (!isAdmin(admin)) fail(403, '此功能只開放系統管理員使用。');
      const list = () =>
        db
          .prepare(
            "SELECT username,nickname FROM users WHERE role='staff' AND password_hash='!' ORDER BY username",
          )
          .all();
      if (req.method === 'GET') return send(res, 200, list());
      if (req.method !== 'POST') fail(405, '不支援此操作。');
      limited(`admin:${admin.id}`, 60);
      const input = await jsonBody(req);
      const name = username(input.username);
      const user = db.prepare('SELECT * FROM users WHERE username=?').get(name);
      if (!user || user.password_hash !== '!' || needsSetup(user))
        fail(404, '找不到這個帳號 ID，請對方先用 Google 登入並設定 ID。');
      if (isAdmin(user)) fail(400, '系統管理員本身就有工作人員權限。');
      // Roles are read from the database on every request, so this applies at once.
      db.prepare('UPDATE users SET role=? WHERE id=?').run(
        input.staff ? 'staff' : 'player',
        user.id,
      );
      return send(res, 200, list());
    }
    if (url.pathname.startsWith('/api/staff/')) {
      const staff = staffFor(req);
      const photo = url.pathname.match(/^\/api\/staff\/photos\/([a-f0-9-]+)$/);
      // Gallery images load as the staff member scrolls; only actions count to the limit.
      if (!(photo && req.method === 'GET')) limited(`staff:${staff.id}`, 120);
      if (url.pathname === '/api/staff/photos' && req.method === 'GET') {
        const spot = stampSpots.find((item) => item.id === url.searchParams.get('spot'));
        if (spot?.method !== 'photo') fail(400, '請選擇拍照關卡。');
        return send(
          res,
          200,
          db
            .prepare(
              'SELECT photos.id,users.username,submitted_at,picked_at IS NOT NULL AS picked FROM photos JOIN users ON users.id=photos.user_id WHERE spot_id=? ORDER BY picked DESC,submitted_at DESC LIMIT 500',
            )
            .all(spot.id)
            .map((row) => ({ ...row, picked: row.picked === 1 })),
        );
      }
      if (photo && req.method === 'GET') {
        const row = db.prepare('SELECT image,mime FROM photos WHERE id=?').get(photo[1]);
        if (!row) fail(404, '找不到這張照片。');
        res.writeHead(200, {
          'Content-Type': row.mime,
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Disposition': 'inline',
        });
        return res.end(row.image);
      }
      if (photo && req.method === 'POST') {
        const input = await jsonBody(req);
        if (typeof input.picked !== 'boolean') fail(400, '請選擇要選入或取消。');
        transaction(() => {
          const row = db.prepare('SELECT spot_id,picked_at FROM photos WHERE id=?').get(photo[1]);
          if (!row) fail(404, '找不到這張照片。');
          if (input.picked && row.picked_at === null) {
            const n = db
              .prepare('SELECT count(*) AS n FROM photos WHERE spot_id=? AND picked_at IS NOT NULL')
              .get(row.spot_id).n;
            if (n >= PICKS_PER_SPOT) fail(409, `每個拍照關卡最多選 ${PICKS_PER_SPOT} 張。`);
          }
          db.prepare('UPDATE photos SET picked_at=?,picked_by=? WHERE id=?').run(
            input.picked ? date() : null,
            input.picked ? staff.username : null,
            photo[1],
          );
        });
        return send(res, 200, { ok: true });
      }
      if (url.pathname === '/api/staff/lookup' && req.method === 'POST') {
        const input = await jsonBody(req);
        if (typeof input.code !== 'string' || !/^[A-F0-9]{24}$/.test(input.code))
          fail(400, '兌獎碼格式不正確。');
        const user = db
          .prepare('SELECT * FROM users WHERE redeem_code=? AND role=?')
          .get(input.code, 'player');
        if (!user) fail(404, '找不到此兌獎碼。');
        const count = stampCount(user.id);
        return send(res, 200, {
          username: user.username,
          count,
          prizes: prizeView(user, count),
          picked: pickedSpots(user.id),
        });
      }
      if (url.pathname === '/api/staff/redeem' && req.method === 'POST') {
        const input = await jsonBody(req);
        if (typeof input.code !== 'string' || !/^[A-F0-9]{24}$/.test(input.code))
          fail(400, '兌獎碼格式不正確。');
        if (!prizeTiers.includes(input.tier)) fail(400, '請選擇要兌換的獎品。');
        const prize = prizes[input.tier];
        const receipt = transaction(() => {
          const user = db
            .prepare("SELECT * FROM users WHERE redeem_code=? AND role='player'")
            .get(input.code);
          if (!user) fail(404, '找不到此兌獎碼。');
          const count = stampCount(user.id);
          if (count < prize.need) fail(409, `集滿 ${prize.need} 個章才能兌換${prize.name}。`);
          if (
            db
              .prepare('SELECT 1 FROM redemptions WHERE user_id=? AND tier=?')
              .get(user.id, input.tier)
          )
            fail(409, `此帳號已兌換過${prize.name}，不能重複領取。`);
          // Inside the transaction, so the 100th and 101st requests cannot both pass.
          if (left(input.tier) <= 0) fail(409, `${prize.name}已全數兌換完畢。`);
          const record = {
            id: randomUUID(),
            username: user.username,
            tier: input.tier,
            redeemed_at: date(),
            reviewer: staff.username,
          };
          db.prepare('INSERT INTO redemptions VALUES (?,?,?,?,?,?)').run(
            record.id,
            user.id,
            record.tier,
            record.redeemed_at,
            record.reviewer,
            count,
          );
          return record;
        });
        return send(res, 201, receipt);
      }
      if (url.pathname === '/api/staff/redemptions' && req.method === 'GET')
        return send(
          res,
          200,
          db
            .prepare(
              'SELECT redemptions.id,users.username,tier,redeemed_at,reviewer,stamp_count FROM redemptions JOIN users ON users.id=redemptions.user_id ORDER BY redeemed_at DESC LIMIT 100',
            )
            .all(),
        );
    }
    fail(404, '找不到此 API。');
  }

  const types = {
    '.html': 'text/html;charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain;charset=utf-8',
  };
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, '不支援此操作。');
      if (url.pathname === '/healthz') {
        db.prepare('SELECT 1').get();
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : 'ok');
      }
      let decoded = '';
      try {
        decoded = decodeURIComponent(url.pathname);
      } catch {
        fail(404, '找不到檔案。');
      }
      if (decoded.split('/').some((part) => part.startsWith('.')) || decoded.includes('\0'))
        fail(404, '找不到檔案。');
      let file = path.resolve(root, `.${decoded}`);
      if (!file.startsWith(root + path.sep) && file !== root) fail(404, '找不到檔案。');
      let info;
      try {
        info = await stat(file);
      } catch {}
      if (!info?.isFile()) {
        if (
          !/^\/(?:game|map|play|staff|privacy)?\/?$/.test(decoded) &&
          !/^\/stamp\/[a-z-]+\/?$/.test(decoded)
        )
          fail(404, '找不到檔案。');
        file = path.join(root, 'index.html');
        info = await stat(file);
      }
      const ext = path.extname(file);
      if (!types[ext]) fail(404, '找不到檔案。');
      res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
      res.setHeader(
        'Cache-Control',
        decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', info.size);
        return res.end();
      }
      // Gzip copies are made at build time (scripts/precompress.mjs); never on request.
      const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
      const packed = gzip ? await stat(`${file}.gz`).catch(() => null) : null;
      if (packed) {
        res.setHeader('Content-Encoding', 'gzip');
        file = `${file}.gz`;
        info = packed;
      }
      if (['.html', '.js', '.css', '.json', '.svg', '.webmanifest'].includes(ext))
        res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', info.size);
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error.status === 429) res.setHeader('Retry-After', '60');
      if (!error.status) console.error('Request failed:', error.code ?? error.name);
      send(res, error.status ?? 500, {
        error: error.status ? error.message : '服務暫時無法使用，請稍後再試。',
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 100;
  return {
    server,
    close: () => {
      clearInterval(expiry);
      db.close();
    },
  };
}
