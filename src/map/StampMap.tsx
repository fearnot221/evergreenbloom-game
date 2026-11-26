import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRightIcon } from '../components/icons';
import { Page, useDocumentTitle } from '../components/page';
import campus from '../data/campus-map.json';
import { display } from '../data/display-copy';
import { getSpot, lulin, stampSpots } from '../data/stamps';
import { useAccount } from '../game/api';
import { LulinSheet, SpotSheet } from '../game/SpotSheet';
import '../styles/pages.css';
import './stamp-map.css';

const [fx, fy, fw, fh] = campus.frame;
const [lon0, lat0] = campus.origin;
const [kx, ky] = campus.scale;
/** A spot's position as a percentage of the drawn frame (same projection as the build). */
/**
 * Where each name sits around its marker. Below by default; these spots crowd their
 * neighbours (中正圖書館 under 大禮堂, 太極銅雕 into 總圖書館), so their names move.
 */
const LABEL: Record<string, 'above' | 'right'> = {
  'chungcheng-library': 'above',
  taichi: 'above',
  'main-library': 'right',
};

const place = ([lon, lat]: [number, number]) => ({
  '--x': `${(((lon - lon0) * kx - fx) / fw) * 100}%`,
  '--y': `${((-(lat - lat0) * ky - fy) / fh) * 100}%`,
});

/**
 * 集章地圖: 新中大十景 on an illustrated campus (OpenStreetMap, simplified). Each landmark
 * is a button that opens the spot's sheet with its full introduction. 鹿林天文台 is on
 * 鹿林前山, far off campus: a marker past the frame's edge, not a stamp.
 */
export default function StampMap() {
  useDocumentTitle(display.pages.stampMap);
  const [params, setParams] = useSearchParams();
  const account = useAccount();
  const collected = account.data?.stamps ?? {};
  // The open sheet. Read from the URL once (a link from the play page or a sheet), then
  // owned here: the URL only mirrors it, so a quick re-tap never races a navigation.
  const [selected, setSelected] = useState(() => params.get('spot'));
  const spot = getSpot(selected);
  const clear = () => {
    setSelected(null);
    setParams({}, { replace: true, preventScrollReset: true });
  };
  const select = (id: string) => {
    setSelected(id);
    setParams({ spot: id }, { replace: true, preventScrollReset: true });
  };
  // On a phone the map scrolls sideways; bring the chosen landmark into view.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = frame.current;
    const pin = box?.querySelector<HTMLElement>(`[data-spot="${selected}"]`);
    if (box && pin) box.scrollLeft = pin.offsetLeft - box.clientWidth / 2;
  }, [selected]);

  return (
    <Page title={display.pages.stampMap} className="stamp-map-page">
      <section aria-labelledby="map-title">
        <h2 id="map-title" className="sr-only">
          校園集章地圖
        </h2>
        <div className="campus-scroll" ref={frame}>
          <div className="campus">
            <svg
              className="campus-art"
              viewBox={campus.frame.join(' ')}
              aria-hidden="true"
              focusable="false"
            >
              <path className="campus-ground" d={campus.boundary} />
              <path className="campus-green" d={campus.green} />
              <path className="campus-water" d={campus.water} />
              <path className="campus-road" d={campus.roads} />
              <path className="campus-path" d={campus.paths} />
              <path className="campus-building" d={campus.buildings} />
            </svg>
            {stampSpots.map((item) => {
              const done = Boolean(collected[item.id]);
              return (
                <button
                  key={item.id}
                  data-spot={item.id}
                  data-label={LABEL[item.id] ?? 'below'}
                  type="button"
                  className={`pin${done ? ' is-done' : ''}${item.id === selected ? ' is-selected' : ''}`}
                  style={place(item.at) as CSSProperties}
                  aria-pressed={item.id === selected}
                  aria-label={`${item.no}. ${item.name}${done ? '，已集章' : ''}`}
                  onClick={() => select(item.id)}
                >
                  <span className="pin-mark latin">{item.no}</span>
                  <span className="pin-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="map-foot">
          <p className="campus-credit">示意地圖・資料 {campus.attribution}</p>
          <button
            type="button"
            className={`lulin${selected === 'lulin' ? ' is-selected' : ''}`}
            aria-pressed={selected === 'lulin'}
            onClick={() => select('lulin')}
          >
            <span className="lulin-dir" aria-hidden="true">
              <ArrowUpRightIcon size={16} weight="bold" />
            </span>
            <span>
              <strong>{lulin.name}</strong>
              <span className="lulin-place">在玉山・校外</span>
            </span>
          </button>
        </div>
      </section>

      <p className="note map-hint">
        點地圖上的地標看景點介紹。數字是新中大十景的編號，櫻花色的是你已經集到的章。
      </p>
      <SpotSheet
        spot={spot ?? null}
        done={Boolean(spot && collected[spot.id])}
        mapLink={false}
        onClose={clear}
      />
      <LulinSheet open={selected === 'lulin'} onClose={clear} />
    </Page>
  );
}
