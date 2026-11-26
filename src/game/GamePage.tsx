import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fitLine } from '../components/fit';
import { MapTrifoldIcon } from '../components/icons';
import { Page, useDocumentTitle } from '../components/page';
import { display } from '../data/display-copy';
import {
  getSpot,
  methodLabels,
  prizes,
  prizeTiers,
  type StampSpot,
  stampSpots,
} from '../data/stamps';
import { AuthForm } from './AuthForm';
import { ApiError, api, type GameState, shortTime, useAccount, useLiveStock } from './api';
import { NicknameEditor } from './NicknameEditor';
import { ProfileSetup } from './ProfileSetup';
import { Progress, reached } from './Progress';
import { QrScanner } from './QrScanner';
import { RedeemQr } from './RedeemQr';
import { SpotSheet } from './SpotSheet';
import { StampReveal } from './StampReveal';
import { type Claim, readClaim, readScan } from './stamp-store';
import { TaskFlow } from './TaskFlow';
import '../styles/pages.css';
import './game.css';

/** Under the code: it is this account's alone, and how it is used. */
const REDEEM_NOTES = ['每個帳號唯一的兌獎碼・請勿分享', '兌獎時出示 QR Code 給工作人員掃描'];

export default function GamePage() {
  useDocumentTitle(display.pages.game);
  const [params, setParams] = useSearchParams();
  const account = useAccount();
  useLiveStock(Boolean(account.data));
  const [active, setActive] = useState<Claim | null>(null);
  const [revealed, setRevealed] = useState<StampSpot | null>(null);
  const [opened, setOpened] = useState<StampSpot | null>(null);
  const [milestone, setMilestone] = useState<
    (NonNullable<ReturnType<typeof reached>> & { soldOut: boolean }) | null
  >(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  // A scanned QR code arrives as ?spot=…&k=…; the server checks it on submit.
  useEffect(() => {
    const claim = readClaim(params);
    if (claim) setActive(claim);
  }, [params]);

  const state = account.data;
  const spot = getSpot(active?.spot ?? null);
  const collected = state?.stamps ?? {};
  const count = Object.keys(collected).length;
  const failed = (error: unknown) => {
    setError((error as Error).message);
    if (error instanceof ApiError && error.status === 401) account.setData(null);
  };
  const player = state && state.user.role === 'player' && !state.user.setup;
  /** A printed station code, typed or scanned: the server says which spot it opens. */
  const resolveCode = async (value: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const key = value.trim().toUpperCase();
      const found = await api<{ spot: string }>('/resolve', { key });
      if (collected[found.spot]) setNotice('這個章已集過了。');
      else setActive({ spot: found.spot, key });
      setCode('');
    } catch (problem) {
      failed(problem);
    } finally {
      setBusy(false);
    }
  };
  // The scanner keeps one callback while the camera runs; it reads the latest state here.
  const scanned = useRef<(text: string) => void>(() => {});
  scanned.current = (text) => {
    const result = readScan(text);
    if (!result) setError('這不是集章點的 QR Code，請掃描集章牌上的 QR Code。');
    else if ('claim' in result)
      setParams({ spot: result.claim.spot, k: result.claim.key }, { replace: true });
    else void resolveCode(result.code);
  };
  const onScan = useCallback((text: string) => scanned.current(text), []);

  return (
    <Page title={display.pages.game} aside={player && <Progress count={count} />} className="game">
      <p className="quiz-error" role="alert">
        {account.error || error}
      </p>
      <p className="status" role="status">
        {account.loading ? '正在讀取伺服器紀錄…' : notice}
      </p>
      {!state && !account.loading && (
        <>
          {spot && (
            <p className="claim">
              你掃到了集章點「{spot.name}」。登入或建立帳號後，就能開始這裡的任務。
            </p>
          )}
          <AuthForm />
          <p className="note">
            第一次玩？先看
            <Link className="text-link" to="/play">
              遊戲玩法
            </Link>
            。
          </p>
        </>
      )}
      {state?.user.setup && <ProfileSetup onSaved={account.setData} />}
      {state && state.user.role !== 'player' && (
        <p>
          工作人員帳號不參加集章兌獎。請前往 <Link to="/staff">兌獎核銷</Link>。
        </p>
      )}
      {player && (
        <>
          {spot && active && !collected[spot.id] && (
            <TaskFlow
              key={spot.id + active.key}
              spot={spot}
              busy={busy || account.loading}
              onSubmit={async (answer, photo) => {
                setBusy(true);
                setError('');
                setNotice('');
                try {
                  const updated = photo
                    ? await api<GameState>(`/claims/${spot.id}/photo`, undefined, {
                        method: 'POST',
                        headers: {
                          'Content-Type': photo.type,
                          'X-Stamp-Key': active.key,
                          'X-Photo-Consent': 'yes',
                        },
                        body: photo,
                      })
                    : await api<GameState>(`/claims/${spot.id}`, { key: active.key, answer });
                  const stop = reached(count, Object.keys(updated.stamps).length);
                  // The prize may already be gone: stock is counted by the server at redemption.
                  setMilestone(
                    stop && {
                      ...stop,
                      soldOut: stop.tier ? updated.prizes[stop.tier].left <= 0 : false,
                    },
                  );
                  account.setData(updated);
                  setActive(null);
                  setParams({}, { replace: true });
                  setRevealed(spot);
                } catch (problem) {
                  // Wrong answers and rejected photos stay with the task, to retry there.
                  if (problem instanceof ApiError && [400, 413, 415].includes(problem.status))
                    throw problem;
                  failed(problem);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          {spot && active && collected[spot.id] && (
            <p className="status">「{spot.name}」已經集過章了，換下一個集章點吧。</p>
          )}
          {!(spot && active && !collected[spot.id]) && <QrScanner onScan={onScan} />}
          <details className="code-more">
            <summary>掃不到 QR Code？輸入代碼</summary>
            <form
              className="code-entry"
              aria-busy={busy}
              onSubmit={(event) => {
                event.preventDefault();
                void resolveCode(code);
              }}
            >
              <label htmlFor="stamp-code" className="sr-only">
                集章點代碼
              </label>
              <div className="code-row">
                <input
                  id="stamp-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={80}
                  autoCapitalize="characters"
                  autoComplete="off"
                  disabled={busy || account.loading}
                  aria-describedby="stamp-code-help"
                />
                <button
                  type="submit"
                  className="button"
                  disabled={busy || account.loading || !code.trim()}
                >
                  前往
                </button>
              </div>
              <p className="note" id="stamp-code-help">
                代碼印在現場 QR Code 下方。
              </p>
            </form>
          </details>

          <section className="book" aria-labelledby="book-title">
            <div className="book-head">
              <h2 id="book-title">新中大十景</h2>
              <Link className="text-link" to="/map">
                <MapTrifoldIcon size={18} aria-hidden="true" />
                集章地圖
              </Link>
            </div>
            {/* 集章冊: one page of ten seals; tap one for its details. */}
            <ol className="seal-grid">
              {stampSpots.map((item) => {
                const done = Boolean(collected[item.id]);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`seal-tile${done ? ' is-done' : ''}`}
                      onClick={() => setOpened(item)}
                      aria-label={`${item.no}. ${item.name}，${done ? '已集章' : methodLabels[item.method]}`}
                    >
                      <span className="display tile-seal cone" aria-hidden="true">
                        {done ? item.name.slice(0, 2) : item.no}
                      </span>
                      <span className="tile-name" aria-hidden="true">
                        {item.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="prize" aria-labelledby="prize-title">
            <h2 id="prize-title">集章獎勵</h2>
            <ul className="prize-list">
              {prizeTiers.map((tier) => {
                const prize = prizes[tier];
                const status = state.prizes[tier];
                // Status first, then the live stock on its own line.
                const lines = status.redemption
                  ? [`已兌換：${shortTime(status.redemption.redeemed_at)}`]
                  : status.left <= 0
                    ? ['已全數兌換完畢']
                    : status.eligible
                      ? ['可以兌換了！', `剩餘 ${status.left} 份・先兌先得`]
                      : [
                          `還差 ${prize.need - count} 個章`,
                          // Remaining / total.
                          `剩餘 ${status.left}/${prize.stock} 份`,
                        ];
                return (
                  <li
                    key={tier}
                    className={`prize-card${status.eligible ? ' is-open' : ''}${status.redemption ? ' is-done' : ''}`}
                  >
                    <p className="prize-need latin">{prize.need}</p>
                    <div>
                      <h3>{prize.name}</h3>
                      {lines.map((line) => (
                        <p key={line} className="note fit" style={fitLine(line)}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
              {stampSpots
                .filter((item) => state.photos[item.id]?.picked)
                .map((item) => {
                  const redeemed = state.photos[item.id].redeemed_at;
                  const note = redeemed ? `已兌換：${shortTime(redeemed)}` : '可以兌換市集餐券了！';
                  return (
                    <li key={item.id} className={`prize-card is-open${redeemed ? ' is-done' : ''}`}>
                      <p className="prize-need latin">佳</p>
                      <div>
                        <h3>{item.name}佳作</h3>
                        <p className="note fit" style={fitLine(note)}>
                          {note}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
            {state.redeemCode && (
              <div className="redeem-card">
                <label htmlFor="redeem-code" className="redeem-kicker">
                  我的兌獎碼
                </label>
                <RedeemQr code={state.redeemCode} />
                <input
                  id="redeem-code"
                  value={state.redeemCode}
                  readOnly
                  className="receipt-code"
                />
                {REDEEM_NOTES.map((line) => (
                  <p key={line} className="note fit" style={fitLine(line)}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {state && (
        <div className="account-row">
          {!state.user.setup && <NicknameEditor state={state} onSaved={account.setData} />}
          <button
            className="text-button"
            type="button"
            disabled={busy || account.loading}
            onClick={() => {
              setNotice('');
              setError('');
              void account.refresh();
            }}
          >
            更新紀錄
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy || account.loading}
            onClick={() => {
              setActive(null);
              setError('');
              setNotice('');
              void account.logout();
            }}
          >
            登出
          </button>
        </div>
      )}
      <p className="note">集章與兌獎需要連線。換手機或清除瀏覽器資料後，登入同一個帳號就能繼續。</p>
      <SpotSheet
        spot={opened}
        done={Boolean(opened && collected[opened.id])}
        onClose={() => setOpened(null)}
      />
      <StampReveal
        spot={revealed}
        milestone={milestone}
        onClose={() => {
          setRevealed(null);
          setMilestone(null);
        }}
      />
    </Page>
  );
}
