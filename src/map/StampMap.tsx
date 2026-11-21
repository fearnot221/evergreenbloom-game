import { type CSSProperties, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRightIcon, CheckIcon } from '../components/icons';
import { Page, useDocumentTitle } from '../components/page';
import campus from '../data/campus-map.json';
import { display } from '../data/display-copy';
import { getSpot, lulin, methodLabels, stampSpots } from '../data/stamps';
import { useAccount } from '../game/api';
import '../styles/pages.css';
import './stamp-map.css';

const [fx, fy, fw, fh] = campus.frame;
const [lon0, lat0] = campus.origin;
const [kx, ky] = campus.scale;
/** A spot's position as a percentage of the drawn frame (same projection as the build). */
const place = ([lon, lat]: [number, number]) => ({
  '--x': `${(((lon - lon0) * kx - fx) / fw) * 100}%`,
  '--y': `${((-(lat - lat0) * ky - fy) / fh) * 100}%`,
});

/**
 * 集章地圖: 新中大十景 on an illustrated campus (OpenStreetMap, simplified). Each landmark
 * is a button; the panel below shows the spot. A spot's full introduction unlocks once it
 * is collected, because several intros contain their own quiz answer. 鹿林天文台 is
 * on 鹿林前山, far off campus: a marker past the frame's edge, not a stamp.
 */
export default function StampMap() {
  useDocumentTitle(display.pages.stampMap);
  const [params, setParams] = useSearchParams();
  const account = useAccount();
  const collected = account.data?.stamps ?? {};
  const selected = params.get('spot');
  const spot = getSpot(selected);
  const select = (id: string) =>
    setParams({ spot: id }, { replace: true, preventScrollReset: true });
  // On a phone the map scrolls sideways; bring the chosen landmark into view.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = frame.current;
    const pin = box?.querySelector<HTMLElement>(`[data-spot="${selected}"]`);
    if (box && pin) box.scrollLeft = pin.offsetLeft - box.clientWidth / 2;
  }, [selected]);

  return (
    <Page
      title={display.pages.stampMap}
      lede="新中大十景分布在校園各處。點地標看看它在哪裡、要完成什麼任務；集到章之後，就能讀到完整的景點介紹。"
      className="stamp-map-page"
    >
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

      <section className="map-panel" aria-live="polite" aria-labelledby="panel-title">
        {spot ? (
          <>
            <p className="panel-kicker">
              第 {spot.no} 景・{methodLabels[spot.method]}
              {collected[spot.id] && (
                <span className="panel-done">
                  <CheckIcon size={14} aria-hidden="true" /> 已集章
                </span>
              )}
            </p>
            <h2 id="panel-title">{spot.name}</h2>
            {collected[spot.id] ? (
              <p>{spot.intro}</p>
            ) : (
              <p>
                到現場掃描 QR Code，完成「{methodLabels[spot.method]}
                」任務，就能讀到這裡的景點介紹。
              </p>
            )}
            {spot.approx && <p className="note">地圖上的位置為概略位置，請以現場集章牌為準。</p>}
            <Link className="text-link" to="/game">
              打開集章冊
            </Link>
          </>
        ) : selected === 'lulin' ? (
          <>
            <p className="panel-kicker">新中大十景・校外</p>
            <h2 id="panel-title">{lulin.name}</h2>
            <p className="note">{lulin.place}</p>
            <p>{lulin.intro}</p>
            <p className="note">鹿林天文台遠在玉山，不設集章點；校園集章改以太極銅雕代替。</p>
          </>
        ) : (
          <>
            <h2 id="panel-title">點一個地標</h2>
            <p>地圖上的數字是新中大十景的編號，櫻花色的是你已經集到的章。</p>
          </>
        )}
      </section>
    </Page>
  );
}
