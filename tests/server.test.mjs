import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createApp } from '../server/app.mjs';

const origin = 'http://localhost:8080';
const secret = 'correct-horse-battery-42';
const SPOTS = [
  'zhongda-road',
  'tingsong',
  'main-library',
  'chungcheng-library',
  'baihua',
  'auditorium',
  'zhongda-lake',
  'friendship-sakura',
  'csrsr-station',
  'taichi',
];
const stampKeys = Object.fromEntries(
  SPOTS.map((id, i) => [id, `SPOT-${String(i).padStart(2, '0')}-TEST-SECRET-1234`]),
);
const PHOTO_SPOTS = ['tingsong', 'zhongda-lake', 'friendship-sakura'];
// Real 1px PNG.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1cAAAAASUVORK5CYII=',
  'base64',
);
/** A correct submission for every quiz and fill spot (photo spots upload instead). */
const correct = {
  'zhongda-road': 0,
  'main-library': 1,
  'chungcheng-library': '陳其寬',
  baihua: 2,
  auditorium: '松果',
  'csrsr-station': 1,
  taichi: 2,
};

async function fixture(t, extra = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'songying-api-'));
  await writeFile(path.join(dir, 'index.html'), '<html>app</html>');
  const options = {
    database: path.join(dir, 'game.sqlite'),
    origin,
    adminUsername: 'admin0001',
    stampKeys,
    staticDir: dir,
    googleClientId: 'client.apps',
    googleClientSecret: 'shh',
    ...extra,
  };
  let app;
  let base;
  const start = async () => {
    app = await createApp(options);
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    base = `http://127.0.0.1:${app.server.address().port}`;
  };
  const stop = async () => {
    app.server.closeAllConnections();
    await new Promise((resolve) => app.server.close(resolve));
    app.close();
  };
  await start();
  t.after(async () => {
    await stop();
    await rm(dir, { recursive: true, force: true });
  });
  const request = async (route, { cookie = '', data, headers = {}, method, raw } = {}) => {
    const response = await fetch(base + route, {
      method: method ?? (data === undefined && raw === undefined ? 'GET' : 'POST'),
      redirect: 'manual',
      headers: {
        Origin: options.origin,
        Cookie: cookie,
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: raw ?? (data === undefined ? undefined : JSON.stringify(data)),
    });
    const bytes = await response.arrayBuffer();
    let value;
    try {
      value = JSON.parse(Buffer.from(bytes).toString());
    } catch {
      value = Buffer.from(bytes);
    }
    return {
      status: response.status,
      headers: response.headers,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      data: value,
    };
  };
  /** A player signs in with Google (token endpoint stubbed), then picks `name` as its ID. */
  const register = async (name = 'participant') => {
    const start = await request('/api/auth/google', { method: 'GET' });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const realFetch = globalThis.fetch;
    const claims = { iss: 'accounts.google.com', aud: options.googleClientId, sub: name };
    globalThis.fetch = async (url, init) => {
      if (String(url) !== 'https://oauth2.googleapis.com/token') return realFetch(url, init);
      const part = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() / 1000 + 60 }));
      return Response.json({ id_token: `e30.${part.toString('base64url')}.sig` });
    };
    let signedIn;
    try {
      signedIn = await request(
        `/api/auth/google/callback?${new URLSearchParams({ code: 'c', state })}`,
        {
          cookie: start.cookie,
        },
      );
    } finally {
      globalThis.fetch = realFetch;
    }
    const response = await request('/api/profile', {
      cookie: signedIn.cookie,
      data: { username: name, nickname: name, role: 'staff' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.data.user.role, name === options.adminUsername ? 'staff' : 'player');
    return { ...response, cookie: signedIn.cookie, headers: signedIn.headers };
  };
  /** The admin signs in and adds a fresh account to the staff list; returns its cookie. */
  const staff = async () => {
    const admin = await register(options.adminUsername);
    const member = await register('staffer01');
    const added = await request('/api/admin/staff', {
      cookie: admin.cookie,
      data: { username: 'staffer01', staff: true },
    });
    assert.equal(added.status, 200);
    // A plain staff member redeems but cannot open the best-photo gallery.
    assert.equal(
      (await request('/api/staff/photos?spot=tingsong', { cookie: member.cookie })).status,
      403,
    );
    const judge = await request('/api/admin/staff', {
      cookie: admin.cookie,
      data: { username: 'staffer01', judge: true },
    });
    assert.equal(judge.status, 200);
    return member.cookie;
  };
  const photo = (cookie, spot, raw = png, extra = {}) =>
    request(`/api/claims/${spot}/photo`, {
      cookie,
      raw,
      headers: {
        'Content-Type': 'image/png',
        'X-Stamp-Key': stampKeys[spot],
        'X-Photo-Consent': 'yes',
        ...extra,
      },
    });
  const collect = async (cookie, spots) => {
    for (const spot of spots) {
      const result = PHOTO_SPOTS.includes(spot)
        ? await photo(cookie, spot)
        : await request(`/api/claims/${spot}`, {
            cookie,
            data: { key: stampKeys[spot], answer: correct[spot] },
          });
      assert.equal(result.status, 200, spot);
    }
  };
  return {
    request,
    register,
    staff,
    collect,
    photo,
    options,
    restart: async () => {
      await stop();
      await start();
    },
  };
}

test('one Compose file, no secondary deployment configs or public station secrets', async () => {
  const names = await readdir('.');
  assert.deepEqual(
    names.filter((name) => /^(docker-)?compose.*\.ya?ml$/.test(name)),
    ['docker-compose.yml'],
  );
  const client = await readFile('src/data/stamps.ts', 'utf8');
  assert.doesNotMatch(client, /\bkey:|\banswer:/);
  // The site is web-only: public/sw.js only retires the former PWA worker and never
  // intercepts requests.
  assert.doesNotMatch(await readFile('public/sw.js', 'utf8'), /'fetch'/);
});

test('login binds server progress to a player, logout revokes the session, role cannot be self-selected', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/me')).status, 401);
  const player = await f.register();
  assert.match(player.headers.get('set-cookie'), /HttpOnly/);
  assert.match(player.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal(player.headers.get('cache-control'), 'no-store');
  assert.equal((await f.request('/api/staff/redemptions', { cookie: player.cookie })).status, 403);
  // There is no password route at all: no registration, no password login.
  for (const route of ['/api/register', '/api/login'])
    assert.equal(
      (await f.request(route, { data: { username: 'participant', password: secret } })).status,
      404,
    );
  assert.equal((await f.request('/api/logout', { cookie: player.cookie, data: {} })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: player.cookie })).status, 401);
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  // Only a hash of the session token is stored.
  const second = await f.register('secondone');
  const row = db
    .prepare('SELECT token_hash FROM sessions WHERE user_id=?')
    .get(second.data.user.id);
  assert.notEqual(row.token_hash, second.cookie.split('=')[1]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 1);
});

test('same-origin checks, malformed and oversized bodies, unknown API and private file isolation', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  assert.equal(
    (
      await f.request('/api/logout', {
        data: {},
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.request('/api/logout', { data: {}, headers: { 'Content-Type': 'text/plain' } }))
      .status,
    415,
  );
  assert.equal(
    (await f.request('/api/logout', { raw: '{', headers: { 'Content-Type': 'application/json' } }))
      .status,
    400,
  );
  assert.equal((await f.request('/api/unknown')).status, 404);
  assert.equal((await f.request('/game')).status, 200);
  assert.equal((await f.request('/map')).status, 200);
  assert.equal((await f.request('/assets/missing.js')).status, 404);
  assert.equal((await f.request('/game.sqlite')).status, 404);
  assert.equal((await f.request('/.env')).status, 404);
  f.options.origin = 'https://game.example';
  await f.restart();
  const secure = await f.register('secure001');
  assert.match(secure.headers.get('set-cookie'), /; Secure/);
  f.options.origin = origin;
  await f.restart();

  assert.equal(
    (
      await f.request('/api/claims/zhongda-road', {
        cookie: player.cookie,
        raw: `{"key":"${'A'.repeat(5000)}"}`,
        headers: { 'Content-Type': 'application/json' },
      })
    ).status,
    413,
  );
});

test('server checks codes, quiz and fill answers, deduplicates stamps and ignores forged user IDs', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const other = await f.register('otheruser1');
  const cookie = player.cookie;
  const claim = (spot, data) => f.request(`/api/claims/${spot}`, { cookie, data });
  assert.equal((await f.request('/api/resolve', { cookie, data: { key: 'GATE-26' } })).status, 400);
  assert.equal(
    (await f.request('/api/resolve', { cookie, data: { key: stampKeys.taichi.toLowerCase() } }))
      .data.spot,
    'taichi',
  );
  // A code only opens its own spot.
  assert.equal((await claim('taichi', { key: stampKeys.baihua, answer: 2 })).status, 400);
  // Wrong or missing quiz answers fail and can be retried.
  assert.equal(
    (await claim('zhongda-road', { key: stampKeys['zhongda-road'], answer: 2 })).status,
    400,
  );
  assert.equal((await claim('zhongda-road', { key: stampKeys['zhongda-road'] })).status, 400);
  assert.equal(
    (await claim('zhongda-road', { key: stampKeys['zhongda-road'], answer: 0 })).status,
    200,
  );
  // Fill answers are normalized; a short reply containing the answer counts.
  const fill = (answer) =>
    claim('chungcheng-library', { key: stampKeys['chungcheng-library'], answer });
  assert.equal((await fill('陳其')).status, 400);
  // A list of guesses is too long to pass, even if it holds the answer.
  assert.equal((await fill('貝聿銘王大閎陳其寬李祖原姚仁喜張樞漢寶德黃聲遠')).status, 400);
  assert.equal((await fill(42)).status, 400);
  assert.equal((await fill(' 陳其寬校友。')).status, 200);
  assert.equal(
    (await claim('auditorium', { key: stampKeys.auditorium, answer: '大禮堂的設計靈感是松果' }))
      .status,
    200,
  );
  // Codes are checked server-side; repeated submissions do not duplicate or forge.
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      claim('baihua', {
        key: stampKeys.baihua,
        answer: 2,
        userId: other.data.user.id,
        earnedAt: '1900-01-01',
      }),
    ),
  );
  assert.ok(results.every((result) => result.status === 200));
  assert.equal(Object.keys(results[0].data.stamps).length, 4);
  assert.ok(Date.parse(results[0].data.stamps.baihua) > Date.parse('2020-01-01'));
  assert.deepEqual((await f.request('/api/me', { cookie: other.cookie })).data.stamps, {});
});

test('two prize tiers: 6 stamps for the meal voucher, 10 for merch, once each, exactly once under concurrency; records survive restart and backup', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const staff = await f.staff();
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  const code = db
    .prepare('SELECT redeem_code FROM users WHERE id=?')
    .get(player.data.user.id).redeem_code;
  const redeem = (tier, cookie = staff) =>
    f.request('/api/staff/redeem', { cookie, data: { code, tier } });
  assert.equal((await redeem('meal', player.cookie)).status, 403);
  assert.equal((await redeem('cake')).status, 400);
  await f.collect(player.cookie, SPOTS.slice(0, 5));
  let me = (await f.request('/api/me', { cookie: player.cookie })).data;
  assert.equal(me.redeemCode, code);
  assert.equal((await redeem('meal')).status, 409);
  await f.collect(player.cookie, SPOTS.slice(5, 6));
  me = (await f.request('/api/me', { cookie: player.cookie })).data;
  assert.equal(me.redeemCode, code);
  assert.deepEqual(
    [me.prizes.meal.eligible, me.prizes.merch.eligible, me.prizes.meal.left],
    [true, false, 100],
  );
  assert.equal((await redeem('merch')).status, 409);
  const results = await Promise.all(Array.from({ length: 6 }, () => redeem('meal')));
  assert.equal(results.filter((item) => item.status === 201).length, 1);
  assert.equal(results.filter((item) => item.status === 409).length, 5);
  await f.collect(player.cookie, SPOTS.slice(6));
  const lookup = (await f.request('/api/staff/lookup', { cookie: staff, data: { code } })).data;
  assert.equal(lookup.count, 10);
  assert.ok(lookup.prizes.meal.redemption);
  assert.equal(lookup.prizes.merch.eligible, true);
  assert.equal((await redeem('merch')).status, 201);
  let records = (await f.request('/api/staff/redemptions', { cookie: staff })).data;
  assert.deepEqual(records.map((r) => r.tier).sort(), ['meal', 'merch']);
  assert.equal(records.find((r) => r.tier === 'meal').stamp_count, 6);
  await f.restart();
  me = (await f.request('/api/me', { cookie: player.cookie })).data;
  assert.equal(me.prizes.merch.redemption.id, records.find((r) => r.tier === 'merch').id);
  assert.equal(me.prizes.merch.left, 99);
  records = (await f.request('/api/staff/redemptions', { cookie: staff })).data;
  assert.equal(records.length, 2);
  const copy = path.join(path.dirname(f.options.database), 'backup.sqlite');
  await backup(db, copy);
  const restored = new DatabaseSync(copy);
  t.after(() => restored.close());
  assert.equal(restored.prepare('SELECT count(*) as n FROM redemptions').get().n, 2);
});

test('each prize stops at its stock of 100, even when the last ones are claimed at once', async (t) => {
  const f = await fixture(t);
  const staff = await f.staff();
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  // 98 earlier receipts from seeded players, then three eligible players race for two.
  const insertUser = db.prepare(
    "INSERT INTO users (id,username,password_hash,role,redeem_code,created_at) VALUES (?,?,'x','player',?,'2026-01-01')",
  );
  const insertReceipt = db.prepare(
    "INSERT INTO redemptions VALUES (?,?,'meal','2026-01-01','staff',6)",
  );
  // One transaction: 98 separate fsyncs block this process (and its server) on slow disks.
  db.exec('BEGIN');
  for (let i = 0; i < 98; i++) {
    insertUser.run(`seed-${i}`, `seed-${i}`, `SEED${String(i).padStart(20, '0')}`);
    insertReceipt.run(`r-${i}`, `seed-${i}`);
  }
  db.exec('COMMIT');
  const codes = [];
  for (const name of ['racer0001', 'racer0002', 'racer0003']) {
    const player = await f.register(name);
    await f.collect(player.cookie, SPOTS.slice(0, 6));
    codes.push(db.prepare('SELECT redeem_code FROM users WHERE username=?').get(name).redeem_code);
  }
  const results = await Promise.all(
    codes.map((code) =>
      f.request('/api/staff/redeem', { cookie: staff, data: { code, tier: 'meal' } }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.match(results.find((r) => r.status === 409).data.error, /兌換完畢/);
});

test('a photo upload with consent earns the stamp at once and is kept; staff pick at most 3 per spot', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const staff = await f.staff();
  const cookie = player.cookie;
  // The photo task cannot be completed without a photo.
  assert.equal(
    (await f.request('/api/claims/tingsong', { cookie, data: { key: stampKeys.tingsong } })).status,
    400,
  );
  assert.equal((await f.photo(cookie, 'tingsong', png, { 'X-Photo-Consent': 'no' })).status, 400);
  assert.equal((await f.photo(cookie, 'tingsong', Buffer.from('<svg onload="x"/>'))).status, 415);
  assert.equal(
    (await f.photo(cookie, 'tingsong', png, { 'Content-Type': 'image/jpeg' })).status,
    415,
  );
  assert.equal((await f.photo(cookie, 'baihua')).status, 400);
  assert.equal((await f.photo(cookie, 'tingsong', Buffer.alloc(3 * 1024 * 1024 + 1))).status, 413);
  const done = await f.photo(cookie, 'tingsong');
  assert.equal(done.status, 200);
  assert.ok(done.data.stamps.tingsong);
  assert.deepEqual(done.data.photos, { tingsong: { picked: false, redeemed_at: null } });
  assert.equal((await f.photo(cookie, 'tingsong')).status, 409);

  // Only staff see the archive; images are served sandboxed and uncached.
  assert.equal((await f.request('/api/staff/photos?spot=tingsong', { cookie })).status, 403);
  assert.equal((await f.request('/api/staff/photos?spot=baihua', { cookie: staff })).status, 400);
  let list = (await f.request('/api/staff/photos?spot=tingsong', { cookie: staff })).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].username, 'participant');
  const image = await f.request(`/api/staff/photos/${list[0].id}`, { cookie: staff });
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('cache-control'), 'no-store');
  assert.match(image.headers.get('content-security-policy'), /sandbox/);

  // Picks: at most 3 per spot, reversible, visible to the player and at the desk.
  for (const name of ['player002', 'player003', 'player004']) {
    const other = await f.register(name);
    await f.photo(other.cookie, 'tingsong');
  }
  list = (await f.request('/api/staff/photos?spot=tingsong', { cookie: staff })).data;
  const pick = (id, picked) =>
    f.request(`/api/staff/photos/${id}`, { cookie: staff, data: { picked } });
  for (const item of list.slice(0, 3)) assert.equal((await pick(item.id, true)).status, 200);
  assert.equal((await pick(list[3].id, true)).status, 409);
  assert.equal((await pick(list[0].id, false)).status, 200);
  assert.equal((await pick(list[3].id, true)).status, 200);
  assert.equal((await pick(list[3].id, true)).status, 200);
  const picked = (await f.request('/api/staff/photos?spot=tingsong', { cookie: staff })).data;
  assert.equal(picked.filter((item) => item.picked).length, 3);
  // Another spot has its own three.
  await f.photo(cookie, 'zhongda-lake');
  const lake = (await f.request('/api/staff/photos?spot=zhongda-lake', { cookie: staff })).data;
  assert.equal((await pick(lake[0].id, true)).status, 200);
  const me = (await f.request('/api/me', { cookie })).data;
  assert.deepEqual(me.photos['zhongda-lake'], { picked: true, redeemed_at: null });
  // A picked photographer gets a redemption code even below 6 stamps.
  assert.ok(me.redeemCode);
  const lookup = await f.request('/api/staff/lookup', {
    cookie: staff,
    data: { code: me.redeemCode },
  });
  assert.deepEqual(
    lookup.data.picked.find((item) => item.spot === 'zhongda-lake'),
    { spot: 'zhongda-lake', redeemed_at: null, reviewer: null },
  );
  // Its voucher is handed out once; then the pick is locked and the player sees it.
  const redeemPhoto = (spot) =>
    f.request('/api/staff/redeem-photo', { cookie: staff, data: { code: me.redeemCode, spot } });
  assert.equal((await redeemPhoto('friendship-sakura')).status, 409);
  assert.equal((await redeemPhoto('zhongda-lake')).status, 201);
  assert.equal((await redeemPhoto('zhongda-lake')).status, 409);
  assert.equal((await pick(lake[0].id, false)).status, 409);
  const after = (await f.request('/api/me', { cookie })).data;
  assert.equal(after.photos['zhongda-lake'].picked, true);
  assert.ok(after.photos['zhongda-lake'].redeemed_at);
  const records = (await f.request('/api/staff/redemptions', { cookie: staff })).data;
  assert.deepEqual(
    records.map((r) => [r.tier, r.spot, r.stamp_count]),
    [['photo', 'zhongda-lake', null]],
  );
});

test('a v1 database migrates: review-only photos dropped, old receipts kept aside, old spot ids no longer count', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  // Rebuild the v1 shape by hand, with an old prototype stamp and a pending photo.
  db.exec(
    "DROP TABLE redemptions; CREATE TABLE redemptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), redeemed_at TEXT NOT NULL, reviewer TEXT NOT NULL, stamp_count INTEGER NOT NULL); DROP TABLE photos; CREATE TABLE photos (id TEXT PRIMARY KEY, image BLOB); INSERT INTO photos VALUES ('p', x'00'); PRAGMA user_version=1",
  );
  db.prepare("INSERT INTO redemptions VALUES ('old',?,'2026-01-01','staff',3)").run(
    player.data.user.id,
  );
  db.prepare("INSERT INTO stamps VALUES (?,'lake','2026-01-01','quiz')").run(player.data.user.id);
  await f.restart();
  assert.equal(db.prepare('SELECT count(*) AS n FROM photos').get().n, 0);
  assert.ok(db.prepare("SELECT 1 FROM pragma_table_info('photos') WHERE name='picked_at'").get());
  assert.equal(db.prepare('SELECT count(*) AS n FROM redemptions_v1').get().n, 1);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  const me = (await f.request('/api/me', { cookie: player.cookie })).data;
  assert.deepEqual(me.stamps, {});
  assert.equal(me.prizes.meal.redemption, null);
});

test('expired sessions are rejected; the admin alone manages staff, and changes apply at once', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(player.data.user.id);
  assert.equal((await f.request('/api/me', { cookie: player.cookie })).status, 401);

  const admin = await f.register('admin0001');
  assert.deepEqual([admin.data.user.role, admin.data.user.admin], ['staff', true]);
  const member = await f.register('member001');
  assert.equal(member.data.user.admin, false);
  const list = (cookie = admin.cookie) => f.request('/api/admin/staff', { cookie });
  const set = (username, staff, cookie = admin.cookie) =>
    f.request('/api/admin/staff', { cookie, data: { username, staff } });
  assert.deepEqual((await list()).data, []);
  // Nobody else can read or change the list, staff included.
  assert.equal((await list(member.cookie)).status, 403);
  assert.equal((await set('member001', true, member.cookie)).status, 403);
  assert.equal((await set('nobody123', true)).status, 404);
  // The same ID rule as sign-up: 8 to 16 letters or digits.
  for (const bad of ['ab', 'has.dot1', 'way-too-long-id-x'])
    assert.equal((await set(bad, true)).data.error, '帳號 ID 須為 8 至 16 個英文字母或數字。');
  assert.equal((await set('admin0001', false)).status, 400);
  assert.deepEqual((await set('MEMBER001', true)).data, [
    { username: 'member001', nickname: 'member001', judge: false },
  ]);
  // Only the admin marks judges; removing someone from staff clears it.
  const judge = (value, cookie = admin.cookie) =>
    f.request('/api/admin/staff', { cookie, data: { username: 'member001', judge: value } });
  assert.equal((await judge(true, member.cookie)).status, 403);
  assert.equal((await judge(true)).data[0].judge, true);
  assert.equal((await f.request('/api/me', { cookie: member.cookie })).data.user.judge, true);
  assert.equal((await f.request('/api/staff/redemptions', { cookie: member.cookie })).status, 200);
  assert.equal((await list(member.cookie)).status, 403);
  // Station codes are for the admin only, not for staff.
  const stations = (cookie) => f.request('/api/admin/stations', { cookie });
  assert.equal((await stations(member.cookie)).status, 403);
  assert.equal((await stations('')).status, 401);
  const codes = (await stations(admin.cookie)).data;
  assert.equal(codes.length, Object.keys(stampKeys).length);
  const road = codes.find((item) => item.id === 'zhongda-road');
  assert.equal(road.key, stampKeys['zhongda-road']);
  assert.equal(road.url, `${origin}/stamp/zhongda-road?k=${stampKeys['zhongda-road']}`);
  assert.equal(
    (await f.request('/api/resolve', { cookie: member.cookie, data: { key: 'x' } })).status,
    403,
  );
  assert.deepEqual((await set('member001', false)).data, []);
  assert.equal((await f.request('/api/staff/redemptions', { cookie: member.cookie })).status, 403);
  assert.equal((await f.request('/api/me', { cookie: member.cookie })).data.user.judge, false);
  assert.equal((await f.request('/api/staff/redemptions', { cookie: admin.cookie })).status, 200);

  // Old password accounts can no longer sign in: their sessions end on restart.
  db.prepare(
    "INSERT INTO users (id,username,password_hash,role,redeem_code,created_at) VALUES ('old','old-staff','salt:hash','staff','OLDCODE','2026-01-01')",
  ).run();
  db.prepare("INSERT INTO sessions VALUES ('h','old',?)").run(Date.now() + 60000);
  await f.restart();
  assert.equal(db.prepare("SELECT count(*) AS n FROM sessions WHERE user_id='old'").get().n, 0);
  assert.deepEqual((await list()).data, []);
});

test('behind a trusted proxy each client gets its own login allowance', async (t) => {
  const f = await fixture(t);
  let n = 0;
  const attempt = (address) =>
    f.request(`/api/auth/google?n=${n++}`, {
      method: 'GET',
      headers: { 'X-Forwarded-For': `203.0.113.9, 198.51.100.${address}` },
    });
  // Without trust, the header is ignored: every request counts against one address.
  for (let i = 0; i < 300; i++) await attempt(i % 200);
  assert.equal((await attempt(250)).status, 429);
  f.options.trustProxy = true;
  await f.restart();
  for (let i = 0; i < 300; i++) assert.equal((await attempt(1)).status, 303);
  assert.equal((await attempt(1)).status, 429);
  assert.equal((await attempt(2)).status, 303);
});

test('unpicked photos expire after the retention period; picked ones stay', async (t) => {
  const f = await fixture(t);
  const player = await f.register();
  const staff = await f.staff();
  await f.photo(player.cookie, 'tingsong');
  await f.photo(player.cookie, 'zhongda-lake');
  const lake = (await f.request('/api/staff/photos?spot=zhongda-lake', { cookie: staff })).data;
  await f.request(`/api/staff/photos/${lake[0].id}`, { cookie: staff, data: { picked: true } });
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  db.prepare("UPDATE photos SET submitted_at='2000-01-01'").run();
  await f.restart();
  assert.equal(db.prepare('SELECT count(*) AS n FROM photos').get().n, 2);
  f.options.photoRetentionDays = 30;
  await f.restart();
  assert.deepEqual(
    db
      .prepare('SELECT spot_id FROM photos')
      .all()
      .map((row) => row.spot_id),
    ['zhongda-lake'],
  );
  // The stamps earned with those photos stay.
  assert.equal(
    Object.keys((await f.request('/api/me', { cookie: player.cookie })).data.stamps).length,
    2,
  );
});

test('serves the build-time gzip copy when the browser accepts it', async (t) => {
  const f = await fixture(t);
  const dir = path.dirname(f.options.database);
  await writeFile(path.join(dir, 'index.html.gz'), gzipSync('<html>packed</html>'));
  const packed = await f.request('/game', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(packed.headers.get('content-encoding'), 'gzip');
  assert.equal(Buffer.from(packed.data).toString(), '<html>packed</html>');
  const plain = await f.request('/game', { headers: { 'Accept-Encoding': 'identity' } });
  assert.equal(plain.headers.get('content-encoding'), null);
  assert.equal(Buffer.from(plain.data).toString(), '<html>app</html>');
  assert.equal((await f.request('/index.html.gz')).status, 404);
});

test('a malformed path is a 404, not a server error', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/%E0%A4')).status, 404);
});

test('rate limits repeated sign-in starts and fails closed on unsafe deployment settings', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 300; i++)
    assert.equal((await f.request('/api/auth/google', { method: 'GET' })).status, 303);
  const blocked = await f.request('/api/auth/google', { method: 'GET' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  await assert.rejects(createApp({ ...f.options, adminUsername: undefined }));
  await assert.rejects(createApp({ ...f.options, origin: 'http://public.example' }), /HTTPS/);
  await assert.rejects(
    createApp({ ...f.options, stampKeys: { ...stampKeys, taichi: 'GATE-26' } }),
    /STAMP_KEYS/,
  );
});

test('Google sign-in: state and PKCE checked, one player per Google subject, no email kept', async (t) => {
  const off = await fixture(t, { googleClientId: '' });
  assert.deepEqual((await off.request('/api/auth/providers')).data, { google: false });
  assert.equal((await off.request('/api/auth/google')).status, 404);

  const f = await fixture(t, { googleClientId: 'client.apps', googleClientSecret: 'shh' });
  assert.deepEqual((await f.request('/api/auth/providers')).data, { google: true });
  const realFetch = globalThis.fetch;
  let claims = {};
  let sent;
  globalThis.fetch = async (url, init) => {
    if (String(url) !== 'https://oauth2.googleapis.com/token') return realFetch(url, init);
    sent = new URLSearchParams(init.body);
    const part = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return Response.json({ id_token: `e30.${part}.sig` });
  };
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  const start = async (next) => {
    const r = await f.request(
      `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`,
      {
        method: 'GET',
      },
    );
    assert.equal(r.status, 303);
    const google = new URL(r.headers.get('location'));
    assert.equal(google.origin, 'https://accounts.google.com');
    assert.equal(google.searchParams.get('redirect_uri'), `${origin}/api/auth/google/callback`);
    return { cookie: r.cookie, state: google.searchParams.get('state'), google };
  };
  const callback = (cookie, query) =>
    f.request(`/api/auth/google/callback?${new URLSearchParams(query)}`, { cookie });
  const good = { iss: 'https://accounts.google.com', aud: 'client.apps', sub: '1234567890' };
  claims = { ...good, exp: Date.now() / 1000 + 60, email: 'someone@example.com' };

  // A forged state, or no state cookie, never reaches Google's token endpoint.
  const a = await start('/?spot=tingsong');
  const forged = await callback(a.cookie, { code: 'c', state: 'wrong' });
  assert.equal(forged.headers.get('location'), '/?spot=tingsong&login=failed');
  assert.equal(sent, undefined);
  assert.equal((await callback('', { code: 'c', state: a.state })).status, 303);
  assert.equal(sent, undefined);

  // The happy path: session cookie set, sent back to the page the player came from.
  const b = await start('/?spot=tingsong');
  const ok = await callback(b.cookie, { code: 'the-code', state: b.state });
  assert.equal(ok.headers.get('location'), '/?spot=tingsong');
  assert.equal(sent.get('code'), 'the-code');
  assert.equal(
    createHash('sha256').update(sent.get('code_verifier')).digest('base64url'),
    b.google.searchParams.get('code_challenge'),
  );
  const me = (await f.request('/api/me', { cookie: ok.cookie })).data;
  assert.equal(me.user.role, 'player');
  assert.match(me.user.username, /^g-[a-f0-9]{10}$/);
  // The same Google account signs in to the same player; it has no password to guess.
  const c = await start();
  const again = await callback(c.cookie, { code: 'x', state: c.state });
  assert.equal(again.headers.get('location'), '/');
  assert.equal((await f.request('/api/me', { cookie: again.cookie })).data.user.id, me.user.id);
  const login = await f.request('/api/login', {
    data: { username: me.user.username, password: secret },
  });
  assert.equal(login.status, 404);
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  assert.equal(db.prepare('SELECT count(*) AS n FROM identities').get().n, 1);
  assert.doesNotMatch(
    JSON.stringify(db.prepare('SELECT * FROM users').all()),
    /someone@example\.com/,
  );

  // Any signed-in account sets its own nickname; it is not a login name.
  const named = await f.request('/api/nickname', {
    cookie: ok.cookie,
    data: { nickname: '  松果　小隊  ' },
  });
  assert.equal(named.status, 200);
  assert.equal(named.data.user.nickname, '松果 小隊');
  assert.equal(named.data.user.username, me.user.username);
  for (const bad of ['a'.repeat(21), 'x\u0007', 42])
    assert.equal(
      (await f.request('/api/nickname', { cookie: ok.cookie, data: { nickname: bad } })).status,
      400,
    );
  assert.equal((await f.request('/api/nickname', { data: { nickname: 'x' } })).status, 401);
  const cleared = await f.request('/api/nickname', { cookie: ok.cookie, data: { nickname: ' ' } });
  assert.equal(cleared.data.user.nickname, null);

  // Until the player picks an account ID and nickname, the game stays closed.
  assert.equal(me.user.setup, true);
  const blocked = await f.request('/api/resolve', { cookie: ok.cookie, data: { key: 'x' } });
  assert.equal(blocked.status, 403);
  const profile = (data) => f.request('/api/profile', { cookie: ok.cookie, data });
  assert.equal((await profile({ username: 'g-0123456789', nickname: '松果' })).status, 400);
  for (const bad of ['pine-cone1', 'pine123', 'a'.repeat(17)])
    assert.equal((await profile({ username: bad, nickname: '松果' })).status, 400);
  assert.equal((await profile({ username: 'pinecone1', nickname: ' ' })).status, 400);
  await f.register('takenid123');
  assert.equal((await profile({ username: 'takenid123', nickname: '松果' })).status, 409);
  const set = await profile({ username: 'PineCone1', nickname: '松果' });
  assert.equal(set.status, 200);
  assert.deepEqual(
    [set.data.user.username, set.data.user.nickname, set.data.user.setup],
    ['pinecone1', '松果', false],
  );
  assert.equal(set.data.user.id, me.user.id);
  assert.equal((await profile({ username: 'otherid12', nickname: 'x' })).status, 409);
  const open = await f.request('/api/resolve', { cookie: ok.cookie, data: { key: 'x' } });
  assert.notEqual(open.status, 403);

  // An open redirect is refused; a token for another client or an expired one fails.
  const d = await start('https://evil.example/');
  claims = { ...good, aud: 'other', exp: Date.now() / 1000 + 60 };
  assert.equal(
    (await callback(d.cookie, { code: 'x', state: d.state })).headers.get('location'),
    '/?login=failed',
  );
  const e = await start();
  claims = { ...good, exp: Date.now() / 1000 - 1 };
  assert.equal(
    (await callback(e.cookie, { code: 'x', state: e.state })).headers.get('location'),
    '/?login=failed',
  );
});

test('staff stats: players, per-spot stamps, photos and handouts; staff only', async (t) => {
  const f = await fixture(t);
  const first = await f.register('player0001');
  const second = await f.register('player0002');
  const staff = await f.staff();
  assert.equal((await f.request('/api/staff/stats', { cookie: first.cookie })).status, 403);
  await f.collect(first.cookie, SPOTS.slice(0, 6));
  await f.collect(second.cookie, SPOTS.slice(0, 2));
  const db = new DatabaseSync(f.options.database);
  t.after(() => db.close());
  const { redeem_code: code } = db
    .prepare('SELECT redeem_code FROM users WHERE id=?')
    .get(first.data.user.id);
  assert.equal(
    (await f.request('/api/staff/redeem', { cookie: staff, data: { code, tier: 'meal' } })).status,
    201,
  );
  const stats = (await f.request('/api/staff/stats', { cookie: staff })).data;
  // The admin and the staff member are not players.
  assert.equal(stats.players, 2);
  assert.equal(stats.pending, 0);
  assert.equal(stats.staff, 1);
  assert.equal(
    stats.signups.reduce((sum, row) => sum + row.n, 0),
    2,
  );
  assert.equal(
    stats.stampsPerDay.reduce((sum, row) => sum + row.n, 0),
    8,
  );
  const spot = Object.fromEntries(stats.spots.map((row) => [row.id, row]));
  assert.equal(spot['zhongda-road'].stamps, 2);
  assert.equal(spot.baihua.stamps, 1);
  assert.equal(spot.taichi.stamps, 0);
  assert.deepEqual([spot.tingsong.photos, spot.tingsong.picked], [2, 0]);
  assert.equal(stats.held[6], 1);
  assert.equal(stats.held[2], 1);
  assert.deepEqual(stats.prizes, { meal: 1, merch: 0 });
  assert.equal(stats.vouchers, 0);
});
