/**
 * 櫻花幾何: seeded, pure geometry for the sakura illustration (Sakura.tsx). Everything is
 * computed once into absolute SVG path strings, so same-style shapes can share a single
 * path element and the drawing never changes between renders.
 *
 *   petal     cubic Bézier outline with a shallow V notch, slightly asymmetric
 *   flower    five varied petals, inner blush, 5 to 10 curved stamens, a few anthers
 *   branch    a tapered ribbon along a cubic Bézier, grown recursively two levels deep
 *   clusters  weighted, elongated groups at branch ends and along branches, with an
 *             overlap check per layer
 */

export type Rng = () => number;
type Pt = [number, number];

/** Mulberry32: small, fast, deterministic. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (v: number) => Math.round(v * 10) / 10;
const pt = ([x, y]: Pt) => `${n1(x)} ${n1(y)}`;
/** Roughly normal in [-1, 1]: clusters thicken in the middle and thin at the edges. */
const bell = (rng: Rng) => (rng() + rng() + rng() - 1.5) / 1.5;

/* Palette (from the brief), as rgb so source stays free of raw hex. */
export const PINKS = [
  'rgb(248 181 204)', // light pink
  'rgb(242 154 181)', // sakura pink
  'rgb(245 166 164)', // coral pink
  'rgb(231 123 160)', // deep pink
  'rgb(217 101 146)', // rose
];
export const CREAM = 'rgb(255 240 216)';
export const IVORY = 'rgb(255 245 218)';
export const LAVENDER = 'rgb(141 107 162)';
export const BERRY = 'rgb(176 74 128)';

/** Place a local point (petal space: base at origin, tip toward -y) on the canvas. */
function place([x, y]: Pt, cx: number, cy: number, angle: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [cx + x * c - y * s, cy + x * s + y * c];
}

/**
 * One petal as a closed cubic path. Left and right halves get their own width and
 * length, the notch sits slightly off-centre, and the base starts a little out from the
 * centre so neighbouring petals overlap there instead of leaving slivers.
 */
export function petal(cx: number, cy: number, angle: number, len: number, wid: number, rng: Rng) {
  const wl = (wid / 2) * (0.9 + rng() * 0.18);
  const wr = (wid / 2) * (0.9 + rng() * 0.18);
  const ll = len * (0.93 + rng() * 0.12);
  const lr = len * (0.93 + rng() * 0.12);
  const nx = (rng() - 0.5) * 0.1 * wid;
  const depth = len * (0.13 + rng() * 0.07);
  const lobe = Math.min(ll, lr);
  const notch: Pt = [nx, -lobe + depth];
  const base: Pt = [0, len * 0.04];
  // Narrow wedge base, straight-ish sides, two soft lobes meeting in a sharp V.
  const segs: Pt[][] = [
    [
      [-wl * 0.34, -ll * 0.08],
      [-wl * 1.04, -ll * 0.4],
      [-wl, -ll * 0.72],
    ],
    [
      [-wl * 0.97, -ll * 0.9],
      [-wl * 0.64, -ll * 1.0],
      [nx - wl * 0.3, -ll * 0.985],
    ],
    [[nx - wl * 0.15, -ll * 0.97], [nx - wid * 0.015, -lobe + depth * 0.72], notch],
    [
      [nx + wid * 0.015, -lobe + depth * 0.72],
      [nx + wr * 0.15, -lr * 0.97],
      [nx + wr * 0.3, -lr * 0.985],
    ],
    [
      [wr * 0.64, -lr * 1.0],
      [wr * 0.97, -lr * 0.9],
      [wr, -lr * 0.72],
    ],
    [[wr * 1.04, -lr * 0.4], [wr * 0.34, -lr * 0.08], base],
  ];
  const at = (p: Pt) => pt(place(p, cx, cy, angle));
  return `M${at(base)}${segs.map(([a, b, c]) => `C${at(a)} ${at(b)} ${at(c)}`).join('')}Z`;
}

export interface Flower {
  x: number;
  y: number;
  size: number;
  /** One fill per petal, so a flower is never a single flat colour. */
  petals: { d: string; fill: string }[];
  /** Darker blush at the heart of every petal, as one path. */
  blush: string;
  stamens: string;
  anthers: string;
  /** The heart: a small disc that closes any gap where the petal bases meet. */
  heart: string;
  /** All five petals as one path (misregistration shadow, background silhouettes). */
  outline: string;
}

const circle = (x: number, y: number, r: number) =>
  `M${n1(x - r)} ${n1(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;

/** A five-petal sakura. `size` is the petal length; `tone` picks the palette step. */
export function flower(x: number, y: number, size: number, rng: Rng, tone = 1): Flower {
  const turn = rng() * Math.PI * 2;
  const petals: Flower['petals'] = [];
  const blush: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = turn + (i * 2 * Math.PI) / 5 + (rng() - 0.5) * 0.14;
    const len = size * (0.92 + rng() * 0.14);
    const wid = len * (0.86 + rng() * 0.14);
    const step = Math.max(0, Math.min(PINKS.length - 1, tone + Math.round((rng() - 0.5) * 2.6)));
    petals.push({ d: petal(x, y, a, len, wid, rng), fill: PINKS[step] });
    blush.push(petal(x, y, a, len * 0.4, wid * 0.3, rng));
  }
  // Never one flat colour: if every petal drew the same step, shift one a step.
  if (petals.every((p) => p.fill === petals[0].fill)) {
    const i = PINKS.indexOf(petals[0].fill);
    petals[2].fill = PINKS[i > 0 ? i - 1 : i + 1];
  }
  // Stamens: 5 to 10 soft curves of different lengths, bending a little sideways.
  const count = 5 + Math.floor(rng() * 6);
  let stamens = '';
  let anthers = '';
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const l = size * (0.3 + rng() * 0.3);
    const end = place([0, -l], x, y, a);
    const bend = place([l * (rng() - 0.5) * 0.45, -l * 0.55], x, y, a);
    stamens += `M${n1(x)} ${n1(y)}Q${pt(bend)} ${pt(end)}`;
    if (rng() < 0.45) {
      const rx = size * 0.045;
      const ry = size * 0.028;
      const deg = n1((a * 180) / Math.PI);
      anthers += `M${n1(end[0] - rx)} ${n1(end[1])}a${n1(rx)} ${n1(ry)} ${deg} 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} ${deg} 1 0 ${n1(-2 * rx)} 0Z`;
    }
  }
  return {
    x,
    y,
    size,
    petals,
    blush: blush.join(''),
    stamens,
    anthers,
    heart: circle(x, y, size * 0.13),
    outline: petals.map((p) => p.d).join(''),
  };
}

/* Branches -------------------------------------------------------------------------- */

export interface Branch {
  p: [Pt, Pt, Pt, Pt];
  w0: number;
  w1: number;
  depth: number;
}

const bez = ([a, b, c, d]: Branch['p'], t: number): Pt => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0],
    k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1],
  ];
};
const tangent = ([a, b, c, d]: Branch['p'], t: number) => {
  const u = 1 - t;
  const x = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
  const y = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
  return Math.atan2(y, x);
};
const widthAt = (b: Branch, t: number) => b.w0 + (b.w1 - b.w0) * t ** 0.8;
const lengthOf = (b: Branch) => {
  let len = 0;
  let prev = b.p[0];
  for (let i = 1; i <= 12; i++) {
    const p = bez(b.p, i / 12);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
};

/** A branch as a filled ribbon: tapering sides along the curve, round tip. */
export function ribbon(b: Branch, steps = 16) {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = bez(b.p, t);
    const a = tangent(b.p, t) + Math.PI / 2;
    const w = widthAt(b, t) / 2;
    left.push([x + Math.cos(a) * w, y + Math.sin(a) * w]);
    right.push([x - Math.cos(a) * w, y - Math.sin(a) * w]);
  }
  const r = n1(b.w1 / 2);
  return `M${left.map(pt).join('L')}A${r} ${r} 0 0 1 ${right.reverse().map(pt).join('L')}Z`;
}

/** Grow children off a branch: alternating sides, uneven angles, two levels deep. */
export function grow(trunk: Branch, rng: Rng, maxDepth = 2): Branch[] {
  const all: Branch[] = [trunk];
  const visit = (parent: Branch) => {
    if (parent.depth >= maxDepth) return;
    const count = parent.depth === 0 ? 3 : 2;
    const len = lengthOf(parent);
    let side = rng() < 0.5 ? -1 : 1;
    for (let k = 0; k < count; k++) {
      const t = 0.24 + ((k + rng() * 0.6) / count) * 0.62;
      const start = bez(parent.p, t);
      const dir = tangent(parent.p, t) + (side * ((24 + rng() * 30) * Math.PI)) / 180;
      const l = len * (parent.depth === 0 ? 0.42 : 0.5) * (0.7 + rng() * 0.5);
      const curl = (side * ((6 + rng() * 14) * Math.PI)) / 180;
      const p1: Pt = [start[0] + Math.cos(dir) * l * 0.35, start[1] + Math.sin(dir) * l * 0.35];
      const p2: Pt = [
        start[0] + Math.cos(dir + curl * 0.5) * l * 0.7,
        start[1] + Math.sin(dir + curl * 0.5) * l * 0.7,
      ];
      const p3: Pt = [start[0] + Math.cos(dir + curl) * l, start[1] + Math.sin(dir + curl) * l];
      const w0 = widthAt(parent, t) * 0.62;
      const child: Branch = {
        p: [start, p1, p2, p3],
        w0,
        w1: Math.max(1.4, w0 * 0.28),
        depth: parent.depth + 1,
      };
      all.push(child);
      visit(child);
      side = -side;
    }
  };
  visit(trunk);
  return all;
}

/* Clusters ---------------------------------------------------------------------------- */

export type Layer = 'back' | 'mid' | 'front';
export interface Placed {
  x: number;
  y: number;
  size: number;
  layer: Layer;
}

/**
 * Cluster-based placement: clusters sit at branch tips and partway along branches, each
 * weighted (tips heavier), stretched along the branch so they are not round balls, and
 * mixing one or two large blooms with medium and small ones. A flower that would sit
 * too deep inside another of the same layer is retried, then dropped.
 */
export function bloomClusters(branches: Branch[], rng: Rng): Placed[] {
  const seeds: { at: Pt; dir: number; weight: number }[] = [];
  for (const b of branches) {
    if (b.depth === 0) {
      seeds.push({ at: bez(b.p, 0.97), dir: tangent(b.p, 0.97), weight: 0.9 });
      seeds.push({ at: bez(b.p, 0.72), dir: tangent(b.p, 0.72), weight: 0.45 });
    } else {
      seeds.push({ at: bez(b.p, 0.95), dir: tangent(b.p, 0.95), weight: b.depth === 2 ? 1 : 0.7 });
      if (b.depth === 1 && rng() < 0.7)
        seeds.push({ at: bez(b.p, 0.5), dir: tangent(b.p, 0.5), weight: 0.35 });
    }
  }
  const placed: Placed[] = [];
  const fits = (p: Placed) =>
    placed.every(
      (q) => q.layer !== p.layer || Math.hypot(q.x - p.x, q.y - p.y) > (q.size + p.size) * 0.62,
    );
  for (const s of seeds) {
    const sizes: [number, Layer][] = [];
    if (s.weight >= 0.7 && rng() < 0.85) sizes.push([30 + rng() * 12, 'front']);
    if (s.weight >= 0.9 && rng() < 0.5) sizes.push([24 + rng() * 8, 'front']);
    const medium = Math.round(1 + s.weight * 2 + rng());
    for (let i = 0; i < medium; i++) sizes.push([15 + rng() * 7, 'mid']);
    const small = Math.round(1 + s.weight * 2 + rng() * 2);
    for (let i = 0; i < small; i++) sizes.push([8 + rng() * 5, 'mid']);
    const along = 26 + s.weight * 30;
    const across = 14 + s.weight * 16;
    for (const [size, layer] of sizes) {
      for (let tries = 0; tries < 6; tries++) {
        // Large blooms stay near the cluster's heart; small ones drift to its edges.
        const spread = layer === 'front' ? 0.5 : size < 13 ? 1.25 : 0.9;
        const u = bell(rng) * along * spread;
        const v = bell(rng) * across * spread;
        const p: Placed = {
          x: s.at[0] + Math.cos(s.dir) * u - Math.sin(s.dir) * v,
          y: s.at[1] + Math.sin(s.dir) * u + Math.cos(s.dir) * v,
          size,
          layer,
        };
        if (fits(p)) {
          placed.push(p);
          break;
        }
      }
    }
  }
  return placed;
}
