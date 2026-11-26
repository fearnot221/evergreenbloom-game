import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fitLine } from '../components/fit';
import { Page, useDocumentTitle } from '../components/page';
import { display } from '../data/display-copy';
import { type PrizeTier, prizes, prizeTiers, stampSpots } from '../data/stamps';
import { AuthForm } from './AuthForm';
import {
  ApiError,
  api,
  type PrizeState,
  quietRefresh,
  savedTime,
  shortTime,
  useAccount,
} from './api';
import { ProfileSetup } from './ProfileSetup';
import { QrScanner } from './QrScanner';
import { StaffAdmin } from './StaffAdmin';
import { StationCodes } from './StationCodes';
import '../styles/pages.css';
import './game.css';

type Lookup = {
  username: string;
  count: number;
  prizes: Record<PrizeTier, PrizeState>;
  /** This player's picked photos: a market meal voucher each, handed out once. */
  picked: { spot: string; redeemed_at: string | null; reviewer: string | null }[];
};
type Photo = { id: string; username: string; submitted_at: string; picked: boolean };
const photoSpots = stampSpots.filter((spot) => spot.method === 'photo');
const PICKS = 3;

/** 拍照關卡佳作: browse each photo spot and pick up to three. */
function Gallery() {
  const [spot, setSpot] = useState(photoSpots[0].id);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setPhotos(await api<Photo[]>(`/staff/photos?spot=${spot}`));
  }, [spot]);
  useEffect(() => {
    setError('');
    load().catch((problem) => setError(problem.message));
  }, [load]);
  const picked = photos.filter((photo) => photo.picked).length;
  return (
    <section aria-labelledby="gallery-title">
      <h2 id="gallery-title">拍照關卡佳作</h2>
      <p className="note">
        每個拍照關卡最多選 {PICKS} 張佳作，獲選者憑兌獎碼到兌獎處領取活動市集餐券。
      </p>
      <div className="tabs" role="group" aria-label="拍照關卡">
        {photoSpots.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`button${item.id === spot ? '' : ' button-ghost'}`}
            aria-pressed={item.id === spot}
            onClick={() => setSpot(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <p className="status" role="status">
        已選 {picked} / {PICKS} 張・共 {photos.length} 張
      </p>
      <p className="quiz-error" role="alert">
        {error}
      </p>
      {photos.length === 0 && <p>這個關卡還沒有照片。</p>}
      <ul className="gallery">
        {photos.map((photo) => (
          <li key={photo.id} className={photo.picked ? 'is-picked' : ''}>
            {/* Same-origin, so the session cookie goes along; lazy, so only photos
                scrolled into view load. */}
            <img
              className="thumb"
              src={`/api/staff/photos/${photo.id}`}
              alt="參加者上傳的關卡照片"
              loading="lazy"
              decoding="async"
            />
            <p>
              <strong>{photo.username}</strong>
              <br />
              <span className="note">{savedTime(photo.submitted_at)}</span>
            </p>
            <button
              type="button"
              className={`button${photo.picked ? '' : ' button-ghost'}`}
              aria-pressed={photo.picked}
              disabled={busy || (!photo.picked && picked >= PICKS)}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api(`/staff/photos/${photo.id}`, { picked: !photo.picked });
                  await load();
                } catch (problem) {
                  setError((problem as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {photo.picked ? '已選為佳作・取消' : '選為佳作'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
/** After a handout: a modal so the desk cannot miss it; 確定 or Escape closes it. */
function Redeemed({ prize, onClose }: { prize: string | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (prize && !dialog.current?.open) dialog.current?.showModal();
  }, [prize]);
  return (
    <dialog
      ref={dialog}
      className="stamp-reveal"
      aria-labelledby="redeemed-title"
      onClose={onClose}
    >
      {prize && (
        <div className="reveal-copy">
          <p className="reveal-kicker">兌換完成</p>
          <h2 id="redeemed-title">{prize}</h2>
          <p>已記錄兌換，請勿重複發放。</p>
          <form method="dialog">
            <button type="submit" className="button">
              確定
            </button>
          </form>
        </div>
      )}
    </dialog>
  );
}

type Row = {
  id: string;
  username: string;
  /** A prize tier, or 'photo' for a best-photo voucher (then `spot` names the spot). */
  tier: PrizeTier | 'photo';
  spot: string | null;
  redeemed_at: string;
  reviewer: string;
  stamp_count: number | null;
};

export default function StaffPage() {
  useDocumentTitle(display.pages.staff);
  const account = useAccount();
  const [records, setRecords] = useState<Row[]>([]);
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setRecords(await api<Row[]>('/staff/redemptions'));
  }, []);
  const role = account.data?.user.role;
  useEffect(() => {
    if (role === 'staff') refresh().catch((error) => setError(error.message));
    else {
      setRecords([]);
      setLookup(null);
      setCode('');
    }
  }, [role, refresh]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
      if (error instanceof ApiError && error.status === 401) account.setData(null);
    } finally {
      setBusy(false);
    }
  };
  const normalized = code.trim().toUpperCase();
  // Every lookup (scan or typed, and the re-read after a handout) also re-reads the stock.
  const find = async (value = normalized) => {
    setLookup(await api<Lookup>('/staff/lookup', { code: value }));
    void quietRefresh();
  };
  /** A scanned player QR Code holds just the redeem code: look it up straight away. */
  const onScan = (text: string) => {
    const value = text.trim().toUpperCase();
    setCode(value);
    setLookup(null);
    void run(() => find(value));
  };

  return (
    <Page title={display.pages.staff} className="game">
      <p className="quiz-error" role="alert">
        {account.error || error}
      </p>
      <p className="status" role="status">
        {account.loading ? '正在確認帳號…' : busy ? '處理中…' : notice}
      </p>
      {!account.data && !account.loading && <AuthForm />}
      {account.data?.user.setup && <ProfileSetup onSaved={account.setData} />}
      {account.data && !account.data.user.setup && (
        <>
          <div className="actions account-bar">
            <span className="account-name">目前帳號：{account.data.user.username}</span>
            {role === 'staff' && (
              <Link className="text-link" to="/stats">
                活動數據
              </Link>
            )}
            <button
              className="button button-ghost"
              type="button"
              disabled={busy || account.loading}
              onClick={() => {
                setError('');
                setNotice('');
                void account.logout();
              }}
            >
              登出
            </button>
          </div>
          {role !== 'staff' ? (
            <p>此帳號沒有工作人員權限，請系統管理員把你的帳號 ID 加入工作人員名單。</p>
          ) : (
            <>
              <section aria-labelledby="stock-title">
                <h2 id="stock-title">剩餘份數</h2>
                <ul className="stock-list">
                  {prizeTiers.map((tier) => {
                    const left = account.data?.prizes[tier].left ?? 0;
                    return (
                      <li key={tier} className={`stock${left <= 0 ? ' is-out' : ''}`}>
                        <span className="stock-name fit" style={fitLine(prizes[tier].name)}>
                          {prizes[tier].name}
                        </span>
                        <span className="latin stock-left">{left}</span>
                        <span className="note">剩餘・共 {prizes[tier].stock} 份</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="note">查詢兌獎碼或兌換後更新。</p>
              </section>
              <section aria-labelledby="redeem-title">
                <h2 id="redeem-title">查詢兌獎碼</h2>
                <QrScanner
                  onScan={onScan}
                  title="掃描兌獎碼"
                  hint="把參加者集章冊上的兌獎 QR Code 對準框內。"
                  fallback="這個瀏覽器無法開啟相機，請關閉這個視窗，輸入參加者出示的兌獎碼。"
                />
                <form
                  className="code-entry"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(() => find());
                  }}
                >
                  <label htmlFor="staff-code">參加者出示的兌獎碼</label>
                  <div className="code-row">
                    <input
                      id="staff-code"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setLookup(null);
                      }}
                      autoComplete="off"
                      autoCapitalize="characters"
                      maxLength={24}
                      required
                      disabled={busy || account.loading}
                    />
                    <button
                      className="button"
                      type="submit"
                      disabled={busy || account.loading || !code.trim()}
                    >
                      查詢資格
                    </button>
                  </div>
                </form>
                {lookup && (
                  <div className="lookup">
                    <p>參加者帳號：{lookup.username}</p>
                    <p>
                      已集 {lookup.count} / {stampSpots.length} 個章
                    </p>
                    <ul className="prize-list">
                      {prizeTiers.map((tier) => {
                        const prize = prizes[tier];
                        const status = lookup.prizes[tier];
                        const note = status.redemption
                          ? `已兌換 ${shortTime(status.redemption.redeemed_at)}`
                          : !status.eligible
                            ? `尚未集滿 ${prize.need} 個章`
                            : status.left <= 0
                              ? '已全數兌換完畢'
                              : `可兌換・剩餘 ${status.left} 份`;
                        return (
                          <li key={tier} className="prize-card is-open">
                            <p className="prize-need latin">{prize.need}</p>
                            <div>
                              <h3>{prize.name}</h3>
                              <p className="note fit" style={fitLine(note)}>
                                {note}
                              </p>
                              {status.redemption && (
                                <p className="note">核銷：{status.redemption.reviewer}</p>
                              )}
                              <button
                                className="button"
                                type="button"
                                disabled={
                                  busy ||
                                  !status.eligible ||
                                  !!status.redemption ||
                                  status.left <= 0
                                }
                                onClick={() =>
                                  void run(async () => {
                                    await api('/staff/redeem', { code: normalized, tier });
                                    setRedeemed(prize.name);
                                    await find();
                                    await refresh();
                                  })
                                }
                              >
                                {status.redemption ? '已兌換' : '確認兌換'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      {lookup.picked.map((photo) => (
                        <li key={photo.spot} className="prize-card is-open">
                          <p className="prize-need latin">佳</p>
                          <div>
                            <h3>{stampSpots.find((item) => item.id === photo.spot)?.name}佳作</h3>
                            <p
                              className="note fit"
                              style={fitLine(
                                photo.redeemed_at
                                  ? `已兌換 ${shortTime(photo.redeemed_at)}`
                                  : '可兌換市集餐券',
                              )}
                            >
                              {photo.redeemed_at
                                ? `已兌換 ${shortTime(photo.redeemed_at)}`
                                : '可兌換市集餐券'}
                            </p>
                            {photo.redeemed_at && <p className="note">核銷：{photo.reviewer}</p>}
                            <button
                              className="button"
                              type="button"
                              disabled={busy || !!photo.redeemed_at}
                              onClick={() =>
                                void run(async () => {
                                  await api('/staff/redeem-photo', {
                                    code: normalized,
                                    spot: photo.spot,
                                  });
                                  setRedeemed(
                                    `${stampSpots.find((item) => item.id === photo.spot)?.name}佳作`,
                                  );
                                  await find();
                                })
                              }
                            >
                              {photo.redeemed_at ? '已兌換' : '確認兌換'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              {account.data.user.admin && <StaffAdmin />}
              {account.data.user.admin && <StationCodes />}
              {account.data.user.judge && <Gallery />}
              <section aria-labelledby="records-title">
                <div className="book-head">
                  <h2 id="records-title">最近 100 筆兌獎紀錄</h2>
                  <button
                    className="button button-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(refresh)}
                  >
                    更新
                  </button>
                </div>
                {records.length === 0 && <p>尚無兌獎紀錄。</p>}
                <ul className="rows">
                  {records.map((record) => (
                    <li key={record.id}>
                      <h3>
                        {record.tier === 'photo'
                          ? `${stampSpots.find((item) => item.id === record.spot)?.name}佳作`
                          : prizes[record.tier].name}
                      </h3>
                      <p>兌換帳號：{record.username}</p>
                      <p>{savedTime(record.redeemed_at)}</p>
                      <p>核銷帳號：{record.reviewer}</p>
                      <p className="note">
                        {/* The first 8 of the UUID: enough to find the row, short to read out. */}
                        編號 {record.id.slice(0, 8).toUpperCase()}
                        {record.stamp_count !== null && `・兌換時 ${record.stamp_count} 個章`}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
      <Redeemed prize={redeemed} onClose={() => setRedeemed(null)} />
    </Page>
  );
}
