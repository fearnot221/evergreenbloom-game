import { useEffect, useState } from 'react';
import { api } from './api';

type Member = { username: string; nickname: string | null; judge: boolean };

/** The system admin adds or removes staff by account ID. */
export function StaffAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Member[]>('/admin/staff')
      .then(setMembers)
      .catch((problem) => setError(problem.message));
  }, []);
  const change = async (username: string, update: { staff: boolean } | { judge: boolean }) => {
    setBusy(true);
    setError('');
    try {
      setMembers(await api<Member[]>('/admin/staff', { username, ...update }));
      if ('staff' in update && update.staff) setId('');
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="staff-admin-title">
      <h2 id="staff-admin-title">工作人員名單</h2>
      <p className="note">
        對方先用 Google 登入並設定帳號 ID，再把 ID 加進名單就有工作人員權限，移除後立即失效。
        工作人員帳號不參加集章兌獎。設為評審的工作人員才能看照片、選佳作。
      </p>
      <form
        className="code-entry"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void change(id.trim(), { staff: true });
        }}
      >
        <label htmlFor="staff-id">帳號 ID</label>
        <div className="code-row">
          <input
            id="staff-id"
            value={id}
            onChange={(event) => setId(event.target.value)}
            minLength={8}
            pattern="[a-zA-Z0-9]{8,16}"
            aria-describedby="staff-id-help"
            autoCapitalize="none"
            autoComplete="off"
            maxLength={16}
            required
            disabled={busy}
          />
          <button className="button" type="submit" disabled={busy || !id.trim()}>
            加入
          </button>
        </div>
        <p id="staff-id-help" className="note">
          8 至 16 個英文字母或數字。
        </p>
      </form>
      <p className="quiz-error" role="alert">
        {error}
      </p>
      {members.length === 0 && <p>名單中還沒有工作人員。</p>}
      <ul className="rows">
        {members.map((member) => (
          <li key={member.username} className="book-head">
            <span>
              {member.nickname ? `${member.nickname}（${member.username}）` : member.username}
              {member.judge && '・評審'}
            </span>
            <span className="actions">
              <button
                className="button button-ghost"
                type="button"
                disabled={busy}
                aria-pressed={member.judge}
                onClick={() => void change(member.username, { judge: !member.judge })}
              >
                {member.judge ? '取消評審' : '設為評審'}
              </button>
              <button
                className="button button-ghost"
                type="button"
                disabled={busy}
                onClick={() => void change(member.username, { staff: false })}
              >
                移除
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
