/**
 * 櫻花枝: the sakura illustration for the title band, drawn from sakura-geometry.ts. Three layers:
 *   back   large blossom silhouettes in deep pink, berry and lavender, no line or stamens
 *   mid    an ivory branch with two levels of forks, small and medium blooms over it
 *   front  large detailed blooms (cream line, blush, stamens, anthers) with a faint
 *          lavender print offset under them
 * Computed once at module load from a fixed seed; the viewBox scales it to any width.
 * Same-style back shapes and branches share one path each to keep the DOM small.
 */
import type { CSSProperties } from 'react';
import {
  BERRY,
  type Branch,
  bloomClusters,
  CREAM,
  type Flower,
  flower,
  grow,
  IVORY,
  LAVENDER,
  PINKS,
  ribbon,
  seeded,
} from './sakura-geometry';

const W = 760;
const H = 520;

function compose() {
  const rng = seeded(20261110);
  const trunks: Branch[] = [
    // Main bough entering from the top-right corner, reaching left and down.
    {
      p: [
        [W + 40, -20],
        [W - 120, 30],
        [W - 250, 120],
        [W - 430, 230],
      ],
      w0: 30,
      w1: 6,
      depth: 0,
    },
    // A lower bough from the right edge.
    {
      p: [
        [W + 30, 260],
        [W - 60, 268],
        [W - 150, 300],
        [W - 230, 360],
      ],
      w0: 17,
      w1: 4,
      depth: 1,
    },
  ];
  const branches = trunks.flatMap((t) => grow(t, rng));
  const placed = bloomClusters(branches, rng);

  // Back: a few large silhouettes behind the boughs, some running off the edges.
  const backTones = [PINKS[3], PINKS[4], BERRY, LAVENDER];
  const back = Array.from({ length: 9 }, (_, i) => {
    const b = flower(W * (0.35 + rng() * 0.7), H * (-0.05 + rng() * 0.85), 52 + rng() * 40, rng);
    return { d: b.outline, fill: backTones[i % backTones.length], opacity: 0.38 + rng() * 0.3 };
  });

  const mid: Flower[] = [];
  const front: Flower[] = [];
  for (const p of placed) {
    // Tone: mostly sakura and coral, darker towards the front for weight.
    const tone = p.layer === 'front' ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 4);
    (p.layer === 'front' ? front : mid).push(flower(p.x, p.y, p.size, rng, tone));
  }
  // Two front blooms cropped by the frame's edges.
  front.push(flower(W - 18, 36, 40, rng, 2), flower(W - 6, 330, 36, rng, 1));
  front.sort((a, b) => a.size - b.size);

  return {
    back,
    branches: branches.map((b) => ribbon(b, b.depth === 0 ? 20 : 12)).join(''),
    mid,
    front,
    offset: front.map((f) => f.outline).join(''),
  };
}

const ART = compose();

/** Petals grouped by fill inside one bloom: at most a few paths per flower. */
function byFill(f: Flower) {
  const groups = new Map<string, string>();
  for (const p of f.petals) groups.set(p.fill, (groups.get(p.fill) ?? '') + p.d);
  return [...groups];
}

function MidBloom({ f }: { f: Flower }) {
  return (
    <>
      {byFill(f).map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} stroke={CREAM} strokeWidth="0.5" strokeOpacity="0.8" />
      ))}
      <path d={f.blush + f.heart} fill={PINKS[4]} fillOpacity="0.4" />
      <path d={f.stamens} fill="none" stroke={CREAM} strokeWidth="0.6" strokeLinecap="round" />
    </>
  );
}

export function FrontBloom({ f, line = 1 }: { f: Flower; line?: number }) {
  return (
    <>
      {f.petals.map((p) => (
        <path
          key={p.d}
          d={p.d}
          fill={p.fill}
          stroke={CREAM}
          strokeWidth={line}
          strokeLinejoin="round"
        />
      ))}
      <path d={f.blush} fill={PINKS[4]} fillOpacity="0.28" />
      <path d={f.heart} fill={PINKS[4]} />
      <path
        d={f.stamens}
        fill="none"
        stroke={CREAM}
        strokeWidth={line * 0.85}
        strokeLinecap="round"
      />
      {f.anthers && <path d={f.anthers} fill={CREAM} />}
    </>
  );
}

export function Sakura({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`sakura ${className}`}
      style={style}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMin meet"
      aria-hidden="true"
      focusable="false"
    >
      <g className="sakura-back">
        {ART.back.map((b) => (
          <path key={b.d} d={b.d} fill={b.fill} fillOpacity={b.opacity} />
        ))}
      </g>
      <path d={ART.branches} fill="rgb(226 204 196)" transform="translate(1.5 3)" />
      <path d={ART.branches} fill={IVORY} />
      {ART.mid.map((f) => (
        <MidBloom key={`${f.x},${f.y}`} f={f} />
      ))}
      {/* Print misregistration: the front blooms' shapes, offset, in lavender. */}
      <path d={ART.offset} fill={LAVENDER} fillOpacity="0.45" transform="translate(2.4 1.8)" />
      {ART.front.map((f) => (
        <FrontBloom key={`${f.x},${f.y}`} f={f} />
      ))}
    </svg>
  );
}

/** Element counts, for the size test. */
export const sakuraStats = {
  back: ART.back.length,
  mid: ART.mid.length,
  front: ART.front.length,
};
