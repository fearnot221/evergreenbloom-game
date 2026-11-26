import { useState } from 'react';
import { api, type GameState } from './api';

/** Shown after a first Google sign-in: the player picks an account ID and a nickname. */
export function ProfileSetup({ onSaved }: { onSaved: (state: GameState) => void }) {
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="auth" aria-labelledby="setup-title">
      <h2 id="setup-title">設定你的帳號</h2>
      <p className="note">
        第一次用 Google 登入，請先設定帳號 ID 和暱稱才能開始集章。帳號 ID 設定後不能更改。
      </p>
      <form
        className="code-entry"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            onSaved(await api<GameState>('/profile', { username, nickname }));
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="account-fields">
          <legend className="sr-only">帳號 ID 與暱稱</legend>
          <label htmlFor="setup-username">帳號 ID</label>
          <input
            id="setup-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            minLength={8}
            maxLength={16}
            pattern="[a-zA-Z0-9]{8,16}"
            autoCapitalize="none"
            autoComplete="username"
            aria-describedby="setup-username-help"
          />
          <p id="setup-username-help" className="note">
            8 至 16 個英文字母或數字。
          </p>
          <label htmlFor="setup-nickname">暱稱</label>
          <input
            id="setup-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
            maxLength={20}
            autoComplete="nickname"
            aria-describedby="setup-nickname-help"
          />
          <p id="setup-nickname-help" className="note">
            最多 20 個字，之後可以再改。
          </p>
          <button className="button" type="submit">
            {busy ? '儲存中…' : '完成設定'}
          </button>
        </fieldset>
        <p className="quiz-error" role="alert">
          {error}
        </p>
      </form>
    </section>
  );
}
