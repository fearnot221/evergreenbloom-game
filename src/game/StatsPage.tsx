import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, useDocumentTitle } from '../components/page';
import { display } from '../data/display-copy';
import { type PrizeTier, prizes, prizeTiers, stampSpots } from '../data/stamps';
import { AuthForm } from './AuthForm';
import { ApiError, api, useAccount } from './api';
import { ProfileSetup } from './ProfileSetup';
import '../styles/pages.css';
import './game.css';

type Day = { day: string; n: number };
type Stats = {
  players: number;
  /** Google sign-ins that have not picked their account ID yet. */
  pending: number;
  staff: number;
  signups: Day[];
  stampsPerDay: Day[];
  spots: { id: string; stamps: number; photos: number; picked: number }[];
  /** held[n]: how many players hold exactly n stamps. */
  held: number[];
  prizes: Record<PrizeTier, number>;
  vouchers: number;
};

/** A horizontal bar chart as a plain list: every value is also printed as text. */
function Bars({ label, rows }: { label: string; rows: { name: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="note">尚無資料。</p>;
  return (
    <ul className="bars" aria-label={label}>
      {rows.map((row) => (
        <li key={row.name}>
          <span className="bar-name">{row.name}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ inlineSize: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="latin bar-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

const spotName = (id: string) => stampSpots.find((spot) => spot.id === id)?.name ?? id;
/** '2026-12-05' → '12/5' */
const dayLabel = (day: string) =>
  day
    .slice(5)
    .replace('-', '/')
    .replace(/(^|\/)0/g, '$1');

export default function StatsPage() {
  useDocumentTitle(display.pages.stats);
  const account = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const role = account.data?.user.role;
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setStats(await api<Stats>('/staff/stats'));
      setUpdated(new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }));
    } catch (problem) {
      setError((problem as Error).message);
      if (problem instanceof ApiError && problem.status === 401) account.setData(null);
    } finally {
      setBusy(false);
    }
  }, [account.setData]);
  useEffect(() => {
    if (role === 'staff') void load();
    else setStats(null);
  }, [role, load]);

  const stamps = stats?.spots.reduce((sum, spot) => sum + spot.stamps, 0) ?? 0;
  const photos = stats?.spots.reduce((sum, spot) => sum + spot.photos, 0) ?? 0;
  return (
    <Page title={display.pages.stats} className="game">
      <p className="quiz-error" role="alert">
        {account.error || error}
      </p>
      <p className="status" role="status">
        {account.loading ? '正在確認帳號…' : busy ? '讀取中…' : ''}
      </p>
      {!account.data && !account.loading && <AuthForm />}
      {account.data?.user.setup && <ProfileSetup onSaved={account.setData} />}
      {account.data && !account.data.user.setup && role !== 'staff' && (
        <p>此帳號沒有工作人員權限，請系統管理員把你的帳號 ID 加入工作人員名單。</p>
      )}
      {role === 'staff' && (
        <div className="actions account-bar">
          <Link className="text-link" to="/staff">
            回兌獎核銷
          </Link>
          <button
            className="button button-ghost"
            type="button"
            disabled={busy}
            onClick={() => void load()}
          >
            更新
          </button>
          {updated && <span className="note">{updated} 更新</span>}
        </div>
      )}
      {role === 'staff' && stats && (
        <>
          <section aria-labelledby="kpi-title">
            <h2 id="kpi-title">總覽</h2>
            <ul className="stock-list kpi-list">
              <li className="stock">
                <span className="stock-name">註冊人數</span>
                <span className="latin stock-left">{stats.players}</span>
                <span className="note">
                  {stats.pending > 0 ? `其中 ${stats.pending} 人尚未設定 ID` : '參加者帳號'}
                </span>
              </li>
              <li className="stock">
                <span className="stock-name">集章總數</span>
                <span className="latin stock-left">{stamps}</span>
                <span className="note">
                  {stats.players > 0
                    ? `平均每人 ${(stamps / stats.players).toFixed(1)} 個`
                    : '尚無參加者'}
                </span>
              </li>
              <li className="stock">
                <span className="stock-name">集滿 {stampSpots.length} 章</span>
                <span className="latin stock-left">{stats.held[stampSpots.length] ?? 0}</span>
                <span className="note">人</span>
              </li>
              <li className="stock">
                <span className="stock-name">照片數</span>
                <span className="latin stock-left">{photos}</span>
                <span className="note">拍照關卡上傳</span>
              </li>
              {prizeTiers.map((tier) => (
                <li key={tier} className="stock">
                  <span className="stock-name">{prizes[tier].name}</span>
                  <span className="latin stock-left">{stats.prizes[tier]}</span>
                  <span className="note">已兌換・共 {prizes[tier].stock} 份</span>
                </li>
              ))}
              <li className="stock">
                <span className="stock-name">佳作餐券</span>
                <span className="latin stock-left">{stats.vouchers}</span>
                <span className="note">
                  已兌換・選出 {stats.spots.reduce((sum, spot) => sum + spot.picked, 0)} 張
                </span>
              </li>
              <li className="stock">
                <span className="stock-name">工作人員</span>
                <span className="latin stock-left">{stats.staff}</span>
                <span className="note">不含系統管理員</span>
              </li>
            </ul>
          </section>
          <section aria-labelledby="spots-title">
            <h2 id="spots-title">各關遊玩人數</h2>
            <p className="note">完成該關、拿到章的參加者人數。</p>
            <Bars
              label="各關遊玩人數"
              rows={stats.spots.map((spot) => ({
                name: spotName(spot.id),
                value: spot.stamps,
              }))}
            />
          </section>
          <section aria-labelledby="photos-title">
            <h2 id="photos-title">各關照片數</h2>
            <Bars
              label="各關照片數"
              rows={stats.spots
                .filter(
                  (spot) => stampSpots.find((item) => item.id === spot.id)?.method === 'photo',
                )
                .map((spot) => ({ name: spotName(spot.id), value: spot.photos }))}
            />
            <p className="note">
              已選佳作：
              {stats.spots
                .filter((spot) => spot.photos > 0 || spot.picked > 0)
                .map((spot) => `${spotName(spot.id)} ${spot.picked} 張`)
                .join('・') || '尚未選出'}
            </p>
          </section>
          <section aria-labelledby="held-title">
            <h2 id="held-title">集章數分布</h2>
            <p className="note">
              持有幾個章的參加者各有多少人。集滿 {prizes.meal.need} 章可換{prizes.meal.name}，
              {prizes.merch.need} 章可換{prizes.merch.name}。
            </p>
            <Bars
              label="集章數分布"
              rows={stats.held.map((n, count) => ({ name: `${count} 章`, value: n }))}
            />
          </section>
          <section aria-labelledby="days-title">
            <h2 id="days-title">每日註冊人數</h2>
            <Bars
              label="每日註冊人數"
              rows={stats.signups.map((row) => ({ name: dayLabel(row.day), value: row.n }))}
            />
            <h2>每日集章數</h2>
            <Bars
              label="每日集章數"
              rows={stats.stampsPerDay.map((row) => ({ name: dayLabel(row.day), value: row.n }))}
            />
          </section>
        </>
      )}
    </Page>
  );
}
