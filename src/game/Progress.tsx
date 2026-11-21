import type { CSSProperties } from 'react';
import { prizes, SHOWER_AT, stampSpots } from '../data/stamps';

const total = stampSpots.length;
/** The bar's three stops: the sakura shower, then each prize. */
export const milestones = [
  { at: SHOWER_AT, label: '撒櫻花' },
  { at: prizes.meal.need, label: '換餐券' },
  { at: prizes.merch.need, label: '換週邊' },
];

/** The milestone just reached when the count went from `before` to `after`, if any. */
export const reached = (before: number, after: number) =>
  milestones.find((m) => before < m.at && after >= m.at) ?? null;

/** 集章進度: the count, a bar, and the three milestones along it. */
export function Progress({ count }: { count: number }) {
  return (
    <div className="progress">
      <p className="progress-count">
        <span className="display">{count}</span>
        <span className="progress-total"> / {total} 個章</span>
      </p>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
        aria-label="集章進度"
        style={{ '--p': count / total } as CSSProperties}
      >
        <span className="progress-fill" />
        {milestones.map((m) => (
          <span
            key={m.at}
            className={`progress-stop${count >= m.at ? ' is-reached' : ''}`}
            style={{ '--at': m.at / total } as CSSProperties}
          >
            <span className="progress-stop-at latin">{m.at}</span>
            <span className="progress-stop-label">{m.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
