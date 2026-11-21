/**
 * 元素庫: each element of the key visual redrawn on its own, in its own SVG, so the UI
 * can place, size and drop them independently (page.tsx, App.tsx, the game pages).
 * They are ingredients, not a scene: no layout here copies the key visual's composition.
 * Style taken from the key visual: flat fills, glowing cloud rims, navy outlines on
 * the large flowers, chunky round stars. Colours come from tokens or rgb() tints;
 * all aria-hidden. Print grain is laid over them by CSS, not drawn here.
 */
import type { CSSProperties, ReactNode } from 'react';
import { FrontBloom } from './Sakura';
import { flower, seeded } from './sakura-geometry';

type MotifProps = { className?: string; style?: CSSProperties };

const svg = (
  viewBox: string,
  className: string,
  style: CSSProperties | undefined,
  body: ReactNode,
) => (
  <svg
    className={`motif ${className}`}
    style={style}
    viewBox={viewBox}
    aria-hidden="true"
    focusable="false"
  >
    {body}
  </svg>
);

const NAVY = 'var(--sky)';

/* One notched cherry petal, base at the origin, tip pointing up. */
export const PETAL = 'M0 0C-15-7-25-25-19-41C-15-50-6-51 0-44C6-51 15-50 19-41C25-25 15-7 0 0Z';

/** Rounded five-point star, centred on the origin, radius ~10. */
export const STAR_PATH =
  'M0-10L2.7-3.7L9.5-3.1L4.4 1.4L5.9 8.1L0 4.6L-5.9 8.1L-4.4 1.4L-9.5-3.1L-2.7-3.7Z';

export const Petal = ({ className = '', style }: MotifProps) =>
  svg(
    '-26 -54 52 58',
    `petal ${className}`,
    style,
    <path d={PETAL} fill="var(--motif-petal-deep)" />,
  );

/** Chunky star; colour via CSS `color`. */
export const StarMark = ({ className = '', style }: MotifProps) =>
  svg(
    '-13 -13 26 26',
    `star ${className}`,
    style,
    <path
      d={STAR_PATH}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />,
  );

/** One sakura from the illustration's geometry (sakura-geometry.ts), for marks and labels. */
const MARK = flower(0, 0, 24, seeded(7), 1);
export const BloomMark = ({ className = '', style }: MotifProps) =>
  svg('-30 -30 60 60', `bloom ${className}`, style, <FrontBloom f={MARK} line={1.6} />);

/** Arcs bulging upward between consecutive points, closed flat at `bottom`. */
function cloudPath(points: [number, number][], bottom: number) {
  const [first, ...rest] = points;
  let d = `M${first[0]} ${bottom}L${first[0]} ${first[1]}`;
  let [px, py] = first;
  for (const [x, y] of rest) {
    const r = (Math.hypot(x - px, y - py) * 0.62).toFixed(1);
    d += `A${r} ${r} 0 0 1 ${x} ${y}`;
    [px, py] = [x, y];
  }
  return `${d}L${px} ${bottom}Z`;
}

// Shapes close 12 units below the 150-unit box: the fill runs past the SVG's bottom edge
// (motifs overflow visibly), so a fractional-pixel edge never shows a seam underneath.
const CLOUD_SHAPES = {
  wide: cloudPath(
    [
      [0, 120],
      [44, 92],
      [104, 70],
      [170, 40],
      [240, 52],
      [300, 84],
      [360, 110],
    ],
    162,
  ),
  tall: cloudPath(
    [
      [0, 128],
      [60, 96],
      [120, 52],
      [196, 30],
      [262, 66],
      [310, 98],
      [360, 124],
    ],
    162,
  ),
  low: cloudPath(
    [
      [0, 130],
      [70, 104],
      [150, 96],
      [220, 82],
      [300, 104],
      [360, 126],
    ],
    162,
  ),
};

const CLOUD_TONES = {
  pink: { fill: 'rgb(232 142 180)', rim: 'rgb(250 194 218)' },
  light: { fill: 'rgb(243 168 196)', rim: 'rgb(255 212 228)' },
  lavender: { fill: 'rgb(150 124 194)', rim: 'rgb(188 166 224)' },
};

/** A cloud with the key visual's glowing rim (a lighter copy nudged up behind it). */
export function Cloud({
  shape = 'wide',
  tone = 'pink',
  className = '',
  style,
}: MotifProps & { shape?: keyof typeof CLOUD_SHAPES; tone?: keyof typeof CLOUD_TONES }) {
  const d = CLOUD_SHAPES[shape];
  const { fill, rim } = CLOUD_TONES[tone];
  return svg(
    '0 0 360 150',
    `cloud ${className}`,
    style,
    <>
      <path d={d} fill={rim} transform="translate(0 -7)" />
      <path d={d} fill={fill} />
    </>,
  );
}

/** The squirrel: pink, navy outline, closed happy eyes, a curled tail. */
export function Squirrel({ className = '', style }: MotifProps) {
  const line = {
    stroke: NAVY,
    strokeWidth: 5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  const pink = 'rgb(236 150 188)';
  return svg(
    '-30 20 345 200',
    `squirrel ${className}`,
    style,
    <>
      <path
        d="M150 196C118 146 126 60 190 40C244 24 286 62 266 104C290 120 284 176 236 190C206 198 176 200 150 196Z"
        fill={pink}
        {...line}
      />
      <path
        d="M216 116C198 106 204 82 224 84C242 87 240 110 222 116"
        fill="none"
        {...line}
        strokeWidth={4}
      />
      <path d="M38 210C42 156 92 124 152 132C204 140 220 186 204 212Z" fill={pink} {...line} />
      <path d="M118 210C116 176 136 156 164 160C180 180 176 198 170 212Z" fill="var(--cream)" />
      <path
        d="M14 124C8 88 38 62 72 64C108 66 128 92 122 122C116 152 84 164 52 158C26 154 16 142 14 124Z"
        fill={pink}
        {...line}
      />
      <path d="M42 74L50 38L76 66Z" fill={pink} {...line} />
      <path d="M50 66L54 50L64 62Z" fill="rgb(250 196 214)" />
      <path d="M40 108Q48 100 56 108M80 106Q88 98 96 106" fill="none" {...line} strokeWidth={4} />
      <ellipse cx="44" cy="124" rx="9" ry="5" fill="rgb(232 112 150)" />
      <ellipse cx="98" cy="121" rx="9" ry="5" fill="rgb(232 112 150)" />
      <path d="M62 124Q69 132 76 124" fill="none" {...line} strokeWidth={3.5} />
      <path d="M58 168C56 150 84 146 94 158C100 172 88 182 72 180Z" fill={pink} {...line} />
      <path d="M78 156L92 150L96 164Z" fill="var(--cream)" />
      <path
        d="M8 52L-8 38M-2 74L-22 70M276 58L292 46M286 86L306 86"
        fill="none"
        {...line}
        strokeWidth={4}
      />
    </>,
  );
}
