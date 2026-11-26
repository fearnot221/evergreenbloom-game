import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from './api';

/** Everyone signs in with Google; staff rights come from the admin's staff list. */
export function AuthForm() {
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
      <h2 id="login-title">{location.pathname === '/staff' ? '工作人員登入' : '登入集章帳號'}</h2>
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
