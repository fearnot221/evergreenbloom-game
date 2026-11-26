import { useEffect, useState } from 'react';
import { api } from './api';
import { RedeemQr } from './RedeemQr';

type Station = { id: string; no: number; name: string; key: string; url: string };

/** Admin only: each spot's secret station code and the QR link printed on its board. */
export function StationCodes() {
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Station[]>('/admin/stations')
      .then(setStations)
      .catch((problem) => setError(problem.message));
  }, []);
  return (
    <section aria-labelledby="stations-title">
      <h2 id="stations-title">集章點代碼</h2>
      <p className="note">
        集章牌上的 QR Code 與手動輸入代碼。代碼外流就能不到現場集章，請勿公開或截圖分享。
      </p>
      <p className="quiz-error" role="alert">
        {error}
      </p>
      <ul className="rows">
        {stations.map((station) => (
          <li key={station.id} className="station-code">
            <RedeemQr code={station.url} label={`${station.name}集章牌的 QR Code`} />
            <div>
              <h3>
                {station.no}. {station.name}
              </h3>
              <p className="receipt-code latin">{station.key}</p>
              <p className="note station-url">{station.url}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
