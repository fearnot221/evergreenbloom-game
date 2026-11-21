import { useEffect, useRef, useState } from 'react';
import { CameraIcon, XIcon } from '../components/icons';

/** The browser's built-in barcode reader (Chromium on Android and desktop; not Safari). */
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

/** Reads one video frame: the text of a QR code in it, or null. */
type Reader = (frame: HTMLVideoElement) => Promise<string | null>;

/** The built-in reader where the browser has one. */
function nativeReader(): Reader {
  const detector = new (window.BarcodeDetector as NonNullable<Window['BarcodeDetector']>)({
    formats: ['qr_code'],
  });
  return async (frame) => (await detector.detect(frame))[0]?.rawValue ?? null;
}

/**
 * Safari (iPhone) has no BarcodeDetector: decode with jsQR, loaded only now. Frames are
 * drawn at most 640 px wide, which keeps decoding quick on a phone and still reads a
 * QR code held at arm's length.
 */
async function scriptReader(): Promise<Reader> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return async (frame) => {
    if (!context || !frame.videoWidth) return null;
    const scale = Math.min(1, 640 / frame.videoWidth);
    canvas.width = Math.round(frame.videoWidth * scale);
    canvas.height = Math.round(frame.videoHeight * scale);
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null
    );
  };
}

/**
 * 掃描 QR Code inside the stamp book. Opens the rear camera only when the player taps
 * the button, reads each frame (the browser's BarcodeDetector, or jsQR on Safari) and
 * hands the text back. Without camera access (not HTTPS, or refused) the dialog points
 * to the phone's camera app or the printed code.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (!open || !supported) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let read: Reader | null = null;
    const scan = async () => {
      if (stopped || !video.current || !read) return;
      try {
        const text = await read(video.current);
        if (text && !stopped) {
          dialog.current?.close();
          onScan(text);
          return;
        }
      } catch {
        /* A frame that is not ready yet; try the next one. */
      }
      timer = window.setTimeout(scan, 250);
    };
    setMessage('正在開啟相機…');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        // Closed before the camera came up: release it straight away.
        if (stopped) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream = media;
        if (!video.current) return;
        video.current.srcObject = media;
        await video.current.play();
        read = 'BarcodeDetector' in window ? nativeReader() : await scriptReader();
        setMessage('把集章牌上的 QR Code 對準框內。');
        void scan();
      })
      .catch(() => setMessage('無法開啟相機。請在瀏覽器設定允許使用相機，或改用下方輸入代碼。'));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [open, supported, onScan]);

  return (
    <>
      <button
        type="button"
        className="button scan-button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <CameraIcon size={20} weight="bold" aria-hidden="true" />
        掃描 QR Code
      </button>
      <dialog
        ref={dialog}
        className="scanner"
        aria-labelledby="scanner-title"
        onClose={() => setOpen(false)}
      >
        <div className="scanner-head">
          <h2 id="scanner-title">掃描集章牌</h2>
          <form method="dialog">
            <button type="submit" className="scanner-close" aria-label="關閉掃描">
              <XIcon size={22} weight="bold" aria-hidden="true" />
            </button>
          </form>
        </div>
        {supported ? (
          <>
            <div className="scanner-view">
              {/* biome-ignore lint/a11y/useMediaCaption: a live camera preview has no audio. */}
              <video ref={video} playsInline muted />
              <span className="scanner-frame" aria-hidden="true" />
            </div>
            <p role="status">{open ? message : ''}</p>
          </>
        ) : (
          <p>
            這個瀏覽器無法開啟相機。請打開手機內建的相機掃描集章牌上的 QR
            Code，會直接開啟這個集章點；也可以關閉這個視窗，輸入 QR Code 下方的代碼。
          </p>
        )}
      </dialog>
    </>
  );
}
