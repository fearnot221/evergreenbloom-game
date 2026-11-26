import type { CSSProperties } from 'react';

/**
 * For `.fit`: the text's width in ems (CJK and full-width ≈ 1, Latin and digits ≈ 0.6),
 * plus slack, so the font size can follow the container and keep the text on one line.
 */
export const fitLine = (text: string) =>
  ({ '--chars': [...text].reduce((n, c) => n + (c > '⹿' ? 1 : 0.6), 0.5) }) as CSSProperties;
