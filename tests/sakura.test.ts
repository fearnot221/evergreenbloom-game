import { describe, expect, it } from 'vitest';
import { sakuraStats } from '../src/components/Sakura';
import { type Branch, flower, grow, petal, seeded } from '../src/components/sakura-geometry';

describe('sakura geometry', () => {
  it('draws a petal as six cubic segments (two lobes and a V notch)', () => {
    const d = petal(0, 0, 0, 40, 36, seeded(1));
    expect(d.match(/C/g)).toHaveLength(6);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('builds a flower of five varied petals and five to ten stamens', () => {
    for (let seed = 1; seed < 40; seed++) {
      const f = flower(0, 0, 30, seeded(seed), 1);
      expect(f.petals).toHaveLength(5);
      expect(new Set(f.petals.map((p) => p.fill)).size).toBeGreaterThan(1);
      const stamens = f.stamens.match(/M/g)?.length ?? 0;
      expect(stamens).toBeGreaterThanOrEqual(5);
      expect(stamens).toBeLessThanOrEqual(10);
    }
  });

  it('is deterministic for a seed', () => {
    expect(flower(5, 5, 20, seeded(9))).toEqual(flower(5, 5, 20, seeded(9)));
  });

  it('forks branches two levels deep and tapers them', () => {
    const trunk: Branch = {
      p: [
        [0, 0],
        [100, 0],
        [200, 50],
        [300, 100],
      ],
      w0: 30,
      w1: 6,
      depth: 0,
    };
    const all = grow(trunk, seeded(3));
    expect(Math.max(...all.map((b) => b.depth))).toBe(2);
    for (const b of all) expect(b.w1).toBeLessThan(b.w0);
  });

  it('fills all three layers', () => {
    expect(sakuraStats.back).toBeGreaterThan(0);
    expect(sakuraStats.mid).toBeGreaterThan(10);
    expect(sakuraStats.front).toBeGreaterThan(3);
  });
});
