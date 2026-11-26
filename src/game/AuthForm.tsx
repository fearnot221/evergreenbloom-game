import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type GameState } from './api';

/** Players sign in with Google only; staff keep their password login. */
export function AuthForm({
  onSuccess,
  staff = false,
}: {
  onSuccess: (state: GameState) => void;
  staff?: boolean;
}) {
  return staff ? <StaffLogin onSuccess={onSuccess} /> : <GoogleLogin />;
}

function GoogleLogin() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const result = params.get('login');
  params.delete('login');
  const query = params.toString();
  const [google, setGoogle] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ google: boolean }>('/auth/providers')
      .then((value) => setGoogle(value.google))
      .catch(() => setGoogle(false));
  }, []);
  return (
    <section className="auth" aria-labelledby="login-title">
      <h2 id="login-title">登入集章帳號</h2>
      <p className="note">
        使用 Google 帳號登入，第一次登入會請你設定帳號 ID 與暱稱。每個參加者帳號限兌獎一次。{' '}
        <Link className="text-link" to="/privacy">
          隱私權政策
        </Link>
      </p>
      {google && (
        <a
          className="button"
          href={`/api/auth/google?next=${encodeURIComponent(location.pathname + (query ? `?${query}` : ''))}`}
        >
          使用 Google 登入
        </a>
      )}
      {google === false && <p className="note">目前暫停登入，請稍後再試。</p>}
      <p className="quiz-error" role="alert">
        {result === 'failed'
          ? 'Google 登入沒有完成，請再試一次。'
          : result === 'cancelled'
            ? '已取消 Google 登入。'
            : ''}
      </p>
    </section>
  );
}

function StaffLogin({ onSuccess }: { onSuccess: (state: GameState) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="auth" aria-labelledby="login-title">
      <h2 id="login-title">工作人員登入</h2>
      <form
        className="code-entry"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const state = await api<GameState>('/login', { username, password });
            setPassword('');
            onSuccess(state);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="account-fields">
          <legend className="sr-only">帳號與密碼</legend>
          <label htmlFor="username">帳號</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoCapitalize="none"
            autoComplete="username"
          />
          <label htmlFor="password">密碼</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
          <button className="button" type="submit">
            {busy ? '處理中…' : '登入'}
          </button>
        </fieldset>
        <p className="quiz-error" role="alert">
          {error}
        </p>
      </form>
    </section>
  );
}
