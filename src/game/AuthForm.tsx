import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type GameState } from './api';

export function AuthForm({
  onSuccess,
  staff = false,
}: {
  onSuccess: (state: GameState) => void;
  staff?: boolean;
}) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const googleResult = params.get('login');
  params.delete('login');
  const query = params.toString();
  const [error, setError] = useState(
    googleResult === 'failed'
      ? 'Google 登入沒有完成，請再試一次。'
      : googleResult === 'cancelled'
        ? '已取消 Google 登入。'
        : '',
  );
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    if (staff) return;
    api<{ google: boolean }>('/auth/providers')
      .then((value) => setGoogle(value.google))
      .catch(() => setGoogle(false));
  }, [staff]);
  return (
    <section className="auth" aria-labelledby="login-title">
      <h2 id="login-title">
        {staff ? '工作人員登入' : register ? '建立參加者帳號' : '登入集章帳號'}
      </h2>
      <p className="note">
        {google ? '可用 Google 帳號或帳號密碼登入' : '目前使用帳號與密碼登入'}
        。每個參加者帳號限兌獎一次。
        {!staff && (
          <>
            {' '}
            <Link className="text-link" to="/privacy">
              隱私權政策
            </Link>
          </>
        )}
      </p>
      {google && (
        <a
          className="button"
          href={`/api/auth/google?next=${encodeURIComponent(location.pathname + (query ? `?${query}` : ''))}`}
        >
          使用 Google 登入
        </a>
      )}
      <form
        className="code-entry"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const state = await api<GameState>(register ? '/register' : '/login', {
              username,
              password,
            });
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
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}"
            autoCapitalize="none"
            autoComplete="username"
            aria-describedby="username-help"
          />
          <p id="username-help" className="note">
            3 至 32 個英文字母、數字、點、底線或連字號。
          </p>
          <label htmlFor="password">密碼</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
            aria-describedby="password-help"
          />
          <p id="password-help" className="note">
            12 至 128 個字元。請妥善保存；目前尚無自助找回密碼功能。
          </p>
          <button className="button" type="submit">
            {busy ? '處理中…' : register ? '註冊並登入' : '登入'}
          </button>
        </fieldset>
        <p className="quiz-error" role="alert">
          {error}
        </p>
      </form>
      {!staff && (
        <button
          className="button button-ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? '已有帳號，改為登入' : '第一次參加，建立帳號'}
        </button>
      )}
    </section>
  );
}
