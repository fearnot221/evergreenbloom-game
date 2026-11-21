import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, MapTrifoldIcon, XIcon } from '../components/icons';
import { display } from '../data/display-copy';
import { methodLabels, type StampSpot } from '../data/stamps';

/**
 * One spot of the stamp grid, as a bottom sheet (a modal dialog, so focus, Escape and
 * the backdrop behave natively). The introduction shows once the spot is collected,
 * as on the map, because several contain their own quiz answer.
 */
export function SpotSheet({
  spot,
  done,
  onClose,
}: {
  spot: StampSpot | null;
  done: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (spot && !dialog.current?.open) dialog.current?.showModal();
  }, [spot]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only the backdrop tap; Escape closes it natively.
    <dialog
      ref={dialog}
      className="spot-sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
    >
      {spot && (
        <div className="sheet-body">
          <div className="sheet-head">
            <span className={`display sheet-seal cone${done ? ' is-done' : ''}`} aria-hidden="true">
              {done ? spot.name.slice(0, 2) : display.flows.seals[spot.method]}
            </span>
            <div>
              <p className="sheet-kicker">
                第 {spot.no} 景・{methodLabels[spot.method]}
              </p>
              <h2 id="sheet-title">{spot.name}</h2>
            </div>
            <form method="dialog">
              <button type="submit" className="sheet-close" aria-label="關閉">
                <XIcon size={22} weight="bold" aria-hidden="true" />
              </button>
            </form>
          </div>
          {done ? (
            <>
              <p className="sheet-done">
                <CheckIcon size={16} weight="bold" aria-hidden="true" /> 已集章
              </p>
              <p>{spot.intro}</p>
            </>
          ) : (
            <p>
              到現場掃描集章牌的 QR Code，完成「{methodLabels[spot.method]}
              」，就能收下這個章並讀到景點介紹。
            </p>
          )}
          <Link className="button button-ghost" to={`/map?spot=${spot.id}`}>
            <MapTrifoldIcon size={18} aria-hidden="true" />
            在地圖上看位置
          </Link>
        </div>
      )}
    </dialog>
  );
}
