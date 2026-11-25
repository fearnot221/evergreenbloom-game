import { useState } from 'react';
import { api, type GameState } from './api';

/** The account's name on the page; players may set a nickname in its place. */
export function NicknameEditor({
  state,
  onSaved,
}: {
  state: GameState;
  onSaved: (state: GameState) => void;
}) {
  const { username, nickname } = state.user;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!editing)
    return (
      <span className="account-name">
        {nickname ? `${nickname}（${username}）` : `目前帳號：${username}`}
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setValue(nickname ?? '');
            setError('');
            setEditing(true);
          }}
        >
          {nickname ? '改暱稱' : '設定暱稱'}
        </button>
      </span>
    );
  return (
    <form
      className="account-name nickname-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          onSaved(await api<GameState>('/nickname', { nickname: value }));
          setEditing(false);
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="nickname">暱稱</label>
      <input
        id="nickname"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={20}
        placeholder={username}
        autoComplete="nickname"
        // biome-ignore lint/a11y/noAutofocus: opened by the player's own click on 設定暱稱.
        autoFocus
        aria-describedby="nickname-help"
        disabled={busy}
      />
      <button className="text-button" type="submit" disabled={busy}>
        {busy ? '儲存中…' : '儲存'}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={busy}
        onClick={() => setEditing(false)}
      >
        取消
      </button>
      <span id="nickname-help" className="note">
        最多 20 個字；留空改回帳號名稱。
      </span>
      <span className="quiz-error" role="alert">
        {error}
      </span>
    </form>
  );
}
