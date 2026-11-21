import { type CSSProperties, useMemo } from 'react';
import { Petal } from './motifs';

const COUNT = 22;

/**
 * 櫻花爆開: petals burst from the centre of the parent box, then drift down and fade.
 * Pure CSS (`burst-out` in components.css): each petal gets its own direction, spin and
 * size as custom properties. `delay` waits for the seal to land first. Remount (a new
 * `key`) to play again. Reduced motion: hidden (components.css).
 */
export function PetalBurst({ delay = 0 }: { delay?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        // Fractions of the burst area (scaled by container units in CSS).
        '--x': (Math.random() - 0.5).toFixed(3),
        '--y': (Math.random() * 0.55 - 0.45).toFixed(3),
        '--r': `${(Math.random() - 0.5) * 400}deg`,
        '--s': (0.6 + Math.random() * 0.65).toFixed(2),
        '--fall': `${(1.8 + Math.random()).toFixed(2)}s`,
        '--delay': `${(delay + Math.random() * 0.18).toFixed(2)}s`,
      })),
    [delay],
  );
  return (
    <div className="petal-burst" aria-hidden="true">
      {petals.map((style, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical decorative petals.
        <Petal key={i} className="burst-petal" style={style as CSSProperties} />
      ))}
    </div>
  );
}
