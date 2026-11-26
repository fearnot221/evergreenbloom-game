import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Petal } from '../components/motifs';
import { PetalBurst } from '../components/PetalBurst';
import { display } from '../data/display-copy';
import { SHOWER_AT, type StampSpot } from '../data/stamps';

/** The last petal lands by 0.35s delay + 0.9s rise + 3.6s fall; then the shower is removed. */
const SHOWER_MS = 5200;
/**
 * 撒花: 36 petals thrown up from both bottom corners, fanning towards the middle, then
 * fluttering down. Fixed values (no Math.random) so every render and test agrees.
 */
export const showerPetals = Array.from({ length: 36 }, (_, i) => {
  const right = i % 2 === 1;
  const reach = 12 + ((i * 23) % 60); // vw towards the middle
  return {
    left: right ? '100%' : '0%',
    '--x': `${right ? -reach : reach}vw`,
    '--peak': `${-(55 + ((i * 17) % 40))}vh`,
    '--drift': `${((i * 29) % 24) - 12}vw`,
    '--r': `${(right ? -1 : 1) * (360 + ((i * 47) % 360))}deg`,
    '--s': (0.7 + ((i * 13) % 7) / 10).toFixed(1),
    '--delay': `${((i * 0.07) % 0.35).toFixed(2)}s`,
    // Two decimals: an invalid duration falls back to 0s and the petal never shows.
    '--fall': `${(2.4 + ((i * 0.37) % 1.2)).toFixed(2)}s`,
  } as CSSProperties;
});

/**
 * After a task: first the spot's knowledge, then 集章成功 (the seal presses down and
 * petals burst). `milestone` names a progress stop just reached; at the sakura stop,
 * closing the dialog (收進集章冊) throws petals up over the whole page (撒花). A native modal dialog, so focus, Escape and the
 * backdrop behave natively. Reduced motion: no burst, no shower, same content.
 */
export function StampReveal({
  spot,
  milestone,
  onClose,
}: {
  spot: StampSpot | null;
  milestone: { at: number; label: string; soldOut: boolean } | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<'intro' | 'stamp'>('intro');
  const [showering, setShowering] = useState(false);
  const shower = milestone?.at === SHOWER_AT;

  useEffect(() => {
    if (!showering) return;
    const timer = window.setTimeout(() => setShowering(false), SHOWER_MS);
    return () => window.clearTimeout(timer);
  }, [showering]);

  useEffect(() => {
    if (!spot) return;
    setStep('intro');
    if (!dialog.current?.open) dialog.current?.showModal();
    // Focus the dialog, not its button: after a quiz, iOS Safari otherwise rings the button.
    dialog.current?.focus();
  }, [spot]);

  return (
    <>
      <dialog
        ref={dialog}
        tabIndex={-1}
        className="stamp-reveal"
        aria-labelledby="reveal-title"
        onClose={() => {
          if (shower) setShowering(true);
          onClose();
        }}
      >
        {spot && step === 'intro' && (
          <div className="reveal-copy">
            <p className="reveal-kicker">第 {spot.no} 景</p>
            <h2 id="reveal-title">{spot.name}</h2>
            <p className="reveal-intro">{spot.intro}</p>
            <button type="button" className="button" onClick={() => setStep('stamp')}>
              收下這個章
            </button>
          </div>
        )}
        {spot && step === 'stamp' && (
          <>
            {/* Remounts with the spot, so each stamp gets a fresh burst after the seal lands. */}
            <PetalBurst key={spot.id} delay={0.42} />
            <div className="reveal-seal cone" aria-hidden="true">
              <span className="display">{spot.name.slice(0, 2)}</span>
            </div>
            <div className="reveal-copy">
              <p className="display reveal-kicker">{display.sections.stamped}</p>
              <h2 id="reveal-title">{spot.name}</h2>
              {milestone && (
                <p className="reveal-milestone">
                  <span>集滿 {milestone.at} 個章！</span>
                  {!shower && (
                    <span>
                      {milestone.soldOut
                        ? '可惜這項獎品已兌換完畢。'
                        : `可以到兌獎處${milestone.label}了。`}
                    </span>
                  )}
                </p>
              )}
              <form method="dialog">
                <button type="submit" className="button">
                  收進集章冊
                </button>
              </form>
            </div>
          </>
        )}
      </dialog>
      {showering && (
        <div className="sakura-shower" aria-hidden="true">
          {showerPetals.map((style, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: identical decorative petals.
            <Petal key={i} style={style} />
          ))}
        </div>
      )}
    </>
  );
}
