import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom';
import {
  ArrowUpRightIcon,
  IdentificationBadgeIcon,
  InfoIcon,
  MapTrifoldIcon,
  SealCheckIcon,
  WifiSlashIcon,
} from '../components/icons';
import { BloomMark, Cloud, StarMark } from '../components/motifs';
import { websiteHref } from '../data/deployment';
import { poster } from '../data/poster-copy';
import { useAccount } from '../game/api';
import { useOnline } from './use-online';
import { useRouteFocus } from './use-route-focus';

export default function App() {
  useRouteFocus();
  const online = useOnline();
  const staff = useAccount().data?.user.role === 'staff';
  return (
    <div className="app">
      <a className="skip-link" href="#route-content">
        跳至主要內容
      </a>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="松櫻祭 集章冊">
          <BloomMark className="brand-emblem" />
          <span className="display brand-word">{poster.wordmark}</span>
        </Link>
        <nav aria-label="遊戲導覽" className="app-nav">
          <NavLink to="/" end>
            <SealCheckIcon size={20} aria-hidden="true" />
            集章冊
          </NavLink>
          <NavLink to="/map">
            <MapTrifoldIcon size={20} aria-hidden="true" />
            集章地圖
          </NavLink>
          <NavLink to="/play">
            <InfoIcon size={20} aria-hidden="true" />
            遊戲玩法
          </NavLink>
          {/* Staff only; staff sign in from the stamp book or at /staff directly. */}
          {staff && (
            <NavLink to="/staff">
              <IdentificationBadgeIcon size={20} aria-hidden="true" />
              工作人員
            </NavLink>
          )}
          <a href={websiteHref()}>
            <ArrowUpRightIcon size={20} aria-hidden="true" />
            活動官網
          </a>
        </nav>
      </header>
      <p className="offline-pill" role="status">
        {!online && (
          <>
            <WifiSlashIcon size={16} aria-hidden="true" />
            離線中 · 集章與登入需連線
          </>
        )}
      </p>
      <Outlet />
      <ScrollRestoration getKey={(location) => location.pathname + location.search} />
      <footer className="app-footer">
        <div className="footer-art" aria-hidden="true">
          <Cloud tone="light" shape="tall" className="footer-cloud footer-cloud-1" />
          <Cloud tone="pink" shape="wide" className="footer-cloud footer-cloud-2" />
          <Cloud tone="light" shape="low" className="footer-cloud footer-cloud-3" />
          <StarMark className="footer-star" />
        </div>
        <div className="footer-body">
          <p className="note">集章遊戲原型，位置與任務待確認。驗章與兌獎需要連線；SSO 尚未串接。</p>
          <a className="text-link" href={websiteHref()}>
            返回活動官網
          </a>
        </div>
      </footer>
    </div>
  );
}
