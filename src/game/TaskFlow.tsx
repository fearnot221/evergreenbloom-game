import { useEffect, useRef, useState } from 'react';
import { fitLine } from '../components/fit';
import { display } from '../data/display-copy';
import { methodLabels, type StampSpot } from '../data/stamps';

type Submit = (answer?: number | string, photo?: Blob) => Promise<void>;

/**
 * The game screen after a scan. Three task types:
 *   quiz   one question, three choices; a wrong answer is cleared to try again
 *   fill   read the passage, then answer with the passage hidden; 回上一步 shows it again
 *   photo  take the photo, agree to its use, upload (shrunk on the phone); the stamp
 *          is granted at once, the photo is kept for the best-photo selection
 * `onSubmit` rejects with the server's message on a wrong answer; it is shown here,
 * next to the task, not at the top of the page.
 */
export function TaskFlow({
  spot,
  busy,
  onSubmit,
}: {
  spot: StampSpot;
  busy: boolean;
  onSubmit: Submit;
}) {
  const [error, setError] = useState('');
  const submit: Submit = async (answer, photo) => {
    setError('');
    try {
      await onSubmit(answer, photo);
    } catch (problem) {
      setError((problem as Error).message);
    }
  };
  return (
    <section className="task" aria-labelledby="task-title">
      <span className="display task-seal cone" aria-hidden="true">
        {display.flows.seals[spot.method]}
      </span>
      <p className="task-method">
        第 {spot.no} 景・{methodLabels[spot.method]}
      </p>
      <h2 id="task-title">{spot.name}</h2>
      {spot.method === 'quiz' && <Quiz spot={spot} busy={busy} submit={submit} error={error} />}
      {spot.method === 'fill' && <Fill spot={spot} busy={busy} submit={submit} error={error} />}
      {spot.method === 'photo' && <Photo spot={spot} busy={busy} submit={submit} error={error} />}
    </section>
  );
}

type Props = { spot: StampSpot; busy: boolean; submit: Submit; error: string };

function Wrong({ error }: { error: string }) {
  return (
    <p className="task-error" role="alert">
      {error}
    </p>
  );
}

function Quiz({ spot, busy, submit, error }: Props) {
  const [answer, setAnswer] = useState<number | null>(null);
  // A wrong answer clears the choice, so the retry is a fresh pick.
  useEffect(() => {
    if (error) setAnswer(null);
  }, [error]);
  return (
    <form
      className="task-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer !== null) void submit(answer);
      }}
    >
      <fieldset disabled={busy}>
        <legend className="task-prompt">{spot.prompt}</legend>
        {spot.options?.map((option, index) => (
          <label key={option} className="quiz-option">
            <input
              type="radio"
              name="answer"
              checked={answer === index}
              onChange={() => setAnswer(index)}
            />
            <span className="latin option-letter">{'ABC'[index]}</span>
            <span className="fit" style={fitLine(option)}>
              {option}
            </span>
          </label>
        ))}
      </fieldset>
      <Wrong error={error} />
      <button type="submit" className="button" disabled={busy || answer === null}>
        {busy ? '確認中…' : error ? '重新作答' : '送出答案'}
      </button>
    </form>
  );
}

function Fill({ spot, busy, submit, error }: Props) {
  const [step, setStep] = useState<'read' | 'answer'>('read');
  const [answer, setAnswer] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === 'answer') field.current?.focus();
  }, [step]);
  if (step === 'read')
    return (
      <div className="task-form">
        <p className="task-step">先讀完說明，答題時不會再顯示</p>
        <div className="passage">
          {spot.passage?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <button type="button" className="button" onClick={() => setStep('answer')}>
          我讀完了，開始作答
        </button>
      </div>
    );
  return (
    <form
      className="task-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim()) void submit(answer.trim());
      }}
    >
      <label className="task-prompt" htmlFor="fill-answer">
        {spot.prompt}
      </label>
      <input
        ref={field}
        id="fill-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        maxLength={40}
        autoComplete="off"
        disabled={busy}
      />
      <Wrong error={error} />
      <div className="actions">
        <button type="submit" className="button" disabled={busy || !answer.trim()}>
          {busy ? '確認中…' : error ? '重新作答' : '送出答案'}
        </button>
        <button type="button" className="button button-ghost" onClick={() => setStep('read')}>
          回上一步重看說明
        </button>
      </div>
    </form>
  );
}

/**
 * Phone photos are often 3 to 10 MB; redraw at most 1600 px on the long side as JPEG
 * (well under the 3 MB limit). Falls back to the original file if the browser cannot
 * decode it here; the server still checks type and size.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.82));
    if (blob) return blob;
  } catch {
    /* Keep the original below. */
  }
  return file;
}

function Photo({ spot, busy, submit, error }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  return (
    <form
      className="task-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!file || !consent) return;
        setWorking(true);
        try {
          await submit(undefined, await shrink(file));
        } finally {
          setWorking(false);
        }
      }}
    >
      <p className="task-prompt">{spot.prompt}</p>
      <label className="button button-ghost photo-pick">
        {preview ? '重拍一張' : '打開相機拍照'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy || working}
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next);
            setPreview(next ? URL.createObjectURL(next) : '');
          }}
        />
      </label>
      {preview && <img className="photo-preview" src={preview} alt="你剛拍的照片" />}
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          我同意上傳並保存這張照片，僅供主辦單位從每個拍照關卡選出 3
          張佳作、發放活動市集餐券，不作其他用途。我已避免拍到其他人的臉。
        </span>
      </label>
      <Wrong error={error} />
      <button type="submit" className="button" disabled={busy || working || !file || !consent}>
        {busy || working ? '上傳中…' : '上傳照片，完成任務'}
      </button>
    </form>
  );
}
