import { type ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, MapTrifoldIcon, XIcon } from '../components/icons';
import { display } from '../data/display-copy';
import { lulin, methodLabels, type StampSpot } from '../data/stamps';
// The sheet's styles live with the stamp book; the map opens sheets too.
import './game.css';

/**
 * A bottom sheet on phones, a centred card on wide screens. A native modal dialog, so
 * focus, Escape and the backdrop behave natively; a tap on the backdrop closes it.
 */
export function Sheet({
  open,
  onClose,
  seal,
  kicker,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  seal: ReactNode;
  kicker: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  // Update state at once on every way out. Not the native `close` event: it is a queued
  // task that can lag, and would then shut a sheet reopened in the meantime.
  const shut = () => {
    dialog.current?.close();
    onClose();
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only the backdrop tap; Escape fires `cancel`.
    <dialog
      ref={dialog}
      className="spot-sheet"
      aria-labelledby="sheet-title"
      onCancel={onClose}
      onClick={(event) => event.target === dialog.current && shut()}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            {seal}
            <div>
              <p className="sheet-kicker">{kicker}</p>
              <h2 id="sheet-title">{title}</h2>
            </div>
            <button type="button" className="sheet-close" aria-label="關閉" onClick={shut}>
              <XIcon size={22} weight="bold" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** One of 新中大十景: its task type, whether it is collected, and its introduction. */
export function SpotSheet({
  spot,
  done,
  onClose,
  mapLink = true,
}: {
  spot: StampSpot | null;
  done: boolean;
  onClose: () => void;
  /** Off on the map itself, where the spot is already in view. */
  mapLink?: boolean;
}) {
  return (
    <Sheet
      open={Boolean(spot)}
      onClose={onClose}
      seal={
        spot && (
          <span className={`display sheet-seal cone${done ? ' is-done' : ''}`} aria-hidden="true">
            {done ? spot.name.slice(0, 2) : display.flows.seals[spot.method]}
          </span>
        )
      }
      kicker={spot && `第 ${spot.no} 景・${methodLabels[spot.method]}`}
      title={spot?.name ?? ''}
    >
      {spot && (
        <>
          {done && (
            <p className="sheet-done">
              <CheckIcon size={16} weight="bold" aria-hidden="true" /> 已集章
            </p>
          )}
          <p>{spot.intro}</p>
          {!done && (
            <p className="note">
              到現場掃描集章牌的 QR Code，完成「{methodLabels[spot.method]}」就能收下這個章。
            </p>
          )}
          {spot.approx && <p className="note">地圖上的位置為概略位置，請以現場集章牌為準。</p>}
          {mapLink && (
            <Link className="button button-ghost" to={`/map?spot=${spot.id}`}>
              <MapTrifoldIcon size={18} aria-hidden="true" />
              在地圖上看位置
            </Link>
          )}
        </>
      )}
    </Sheet>
  );
}

/** 鹿林天文台: one of the ten scenes, but on 玉山, so an introduction without a stamp. */
export function LulinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      seal={
        <span className="display sheet-seal cone" aria-hidden="true">
          鹿林
        </span>
      }
      kicker="新中大十景・校外"
      title={lulin.name}
    >
      <p className="note">{lulin.place}</p>
      <p>{lulin.intro}</p>
      <p className="note">鹿林天文台遠在玉山，不設集章點；校園集章改以太極銅雕代替。</p>
    </Sheet>
  );
}
