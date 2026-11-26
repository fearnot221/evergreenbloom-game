import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { poster } from '../data/poster-copy';
import { Cloud } from './motifs';
import { Sakura } from './Sakura';

/**
 * The cloud tops along the band's bottom edge, varied so the row does not repeat visibly.
 * Enough of them to span a 2800px screen at the widest cloud size; the band clips the rest.
 */
const EDGE = [
  'low',
  'tall',
  'wide',
  'low',
  'wide',
  'tall',
  'low',
  'wide',
  'tall',
  'low',
  'wide',
  'tall',
  'low',
  'wide',
] as const;

/** The site's name; the home page uses it alone, other pages as 「頁名｜站名」. */
export const SITE_NAME = '國立中央大學松櫻祭集章遊戲';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title}｜${SITE_NAME}` : SITE_NAME;
  }, [title]);
}

/**
 * Page layout: a compact night-sky title band, then the content sheet. The band reads
 * left to right like an app screen title (eyebrow, title); a sakura bough
 * (Sakura.tsx) grows in from the top-right corner and a cloud edge closes the band.
 * `title` must come from display-copy so the display subset covers it; dynamic titles
 * use `plainTitle` and the body face. `aside` sits beside the title on wide screens.
 */
export function Page({
  title,
  plainTitle,
  aside,
  className = '',
  children,
}: {
  title?: string;
  plainTitle?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main id="route-content" tabIndex={-1} className={`page ${className}`}>
      <header className="page-head">
        <Sakura className="head-sakura" />
        <div className="head-inner">
          <p className="head-eyebrow">{`${poster.school}${poster.wordmark}`}</p>
          <h1 className={title ? 'display page-title' : 'page-title is-plain'}>
            {title ?? plainTitle}
          </h1>
          {aside}
        </div>
        <div className="head-edge" aria-hidden="true">
          {EDGE.map((shape, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative row.
            <Cloud key={i} tone="light" shape={shape} />
          ))}
        </div>
      </header>
      <div className="sheet">{children}</div>
    </main>
  );
}
