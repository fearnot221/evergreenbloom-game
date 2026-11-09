import { Link, useSearchParams } from 'react-router-dom';
import { Ink } from '../components/Ink';
import { ArrowUpRightIcon } from '../components/icons';
import { Page, useDocumentTitle } from '../components/page';
import { websiteHref } from '../data/deployment';
import { display } from '../data/display-copy';
import { getSpot, methodLabels, stampSpots } from '../data/stamps';
import { readClaim } from '../game/stamp-store';
import { gsap, MOTION, stamp, useGSAP } from '../motion/gsap';
import '../styles/pages.css';

const methods = [
  {
    id: 'qr',
    text: '到集章點掃描 QR Code。QR Code 下方印有代碼，掃描不順時可直接在 App 輸入。',
  },
  { id: 'quiz', text: '讀完現場的說明，回答一題選擇題。答案都寫在說明裡，不會找不到。' },
  { id: 'photo', text: '在定點拍下指定的東西。集章成功後會出現這個地點的介紹。' },
] as const;

export default function PlayPage() {
  useDocumentTitle(display.pages.play);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const list = document.querySelector('.seal-methods');
      if (list) stamp(gsap.utils.toArray('.seal-methods .seal'), list);
    });
    return () => mm.revert();
  });
  const [params] = useSearchParams();
  const claim = readClaim(params);
  const spot = getSpot(claim?.spot ?? null);

  return (
    <Page
      title={display.pages.play}
      lede="第二屆的大地遊戲是走遍校園的實景集章。用手機瀏覽器打開集章冊、登入帳號就能開始；這一頁說明怎麼集章。"
      className="play"
    >
      {spot && claim && (
        <section className="claim" aria-labelledby="claim-title">
          <h2 id="claim-title">待驗證集章點「{spot.name}」</h2>
          <p>
            這只是待驗證的掃碼資訊；登入後由伺服器確認代碼與任務。如果集章冊沒有自動帶入，輸入代碼{' '}
            <strong className="latin">{claim.key}</strong>。
          </p>
        </section>
      )}

      <Link className="button" to={claim ? `/?spot=${claim.spot}&k=${claim.key}` : '/'}>
        打開集章冊
        <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
      </Link>

      <section aria-labelledby="how-title">
        <h2 className="display section-title" id="how-title" data-ink>
          <Ink text={display.sections.howStamp} />
        </h2>
        {/* 印章: the three ways to collect, each pressed on as a seal. */}
        <ol className="seal-methods">
          {methods.map((method) => (
            <li key={method.id}>
              <span className="display seal" aria-hidden="true">
                {display.flows.seals[method.id]}
              </span>
              <h3>{methodLabels[method.id]}</h3>
              <p>{method.text}</p>
            </li>
          ))}
        </ol>
        <p className="note">
          目前規劃 {stampSpots.length} 個示範集章點，位置與題目待團隊確認。集章點會標在
          <a className="text-link" href={websiteHref('map')}>
            校園地圖
          </a>
          上。
        </p>
      </section>

      <section aria-labelledby="signin-title">
        <h2 className="display section-title" id="signin-title" data-ink>
          <Ink text={display.sections.signIn} />
        </h2>
        <p>
          目前以帳號與密碼註冊及登入，進度保存在伺服器資料庫。可在同一帳號登入後繼續集章；每個帳號限兌獎一次。
        </p>
        <p className="note">
          SSO
          尚未串接。請妥善保存密碼，目前尚未提供自助找回密碼功能。舊版裝置上的示範集章不會轉成有效章。
        </p>
      </section>

      <section id="privacy" aria-labelledby="privacy-title">
        <h2 className="display section-title" id="privacy-title" data-ink>
          <Ink text={display.sections.privacy} />
        </h2>
        <ul className="rows">
          <li>照片只用來確認你完成了集章任務，不會用於其他用途或公開。</li>
          <li>請拍指定的物件或集章牌，避免拍到其他人的臉。</li>
          <li>如果照片裡不小心拍到人，請重新拍攝，避免將他人影像上傳。</li>
          <li>
            照片需經你同意後上傳至伺服器，由已登入的工作人員審核。照片上限 3 MB，限 JPEG、PNG 或
            WebP。
          </li>
        </ul>
        <p className="note">
          通過或退回時會移除照片內容，並保留任務狀態、審核帳號與時間。未處理照片最多保留 7
          天；到期須重新上傳。備份中的資料須依主辦單位保存政策處理。正式隱私權政策待確認後公布。
        </p>
      </section>
    </Page>
  );
}
