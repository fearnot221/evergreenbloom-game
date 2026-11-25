import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRightIcon, MapTrifoldIcon } from '../components/icons';
import { Page, useDocumentTitle } from '../components/page';
import { display } from '../data/display-copy';
import { getSpot, lulin, methodLabels, prizes, type StampMethod, stampSpots } from '../data/stamps';
import { readClaim } from '../game/stamp-store';
import '../styles/pages.css';

const countOf = (method: StampMethod) => stampSpots.filter((s) => s.method === method).length;

const steps = [
  {
    title: '掃描 QR Code',
    text: '到新中大十景的集章點，按集章冊的「掃描 QR Code」，或直接用手機相機掃描集章牌。第一次玩要先建立集章帳號。',
  },
  {
    title: '完成關卡遊戲',
    text: '每個集章點有一個小遊戲：知識問答、拍場景照，或是讀說明找答案。答錯了可以重新作答。',
  },
  {
    title: '解鎖景點知識',
    text: '過關後會先跳出這個景點的介紹，讀完收下，就集章成功。',
  },
  {
    title: '進度往前、兌換獎勵',
    text: `集滿 ${prizes.meal.need} 個、${prizes.merch.need} 個章可以到兌獎處兌換獎品。`,
  },
];

const methods: { id: StampMethod; text: string }[] = [
  {
    id: 'quiz',
    text: `${countOf('quiz')} 個景點：關於中大的三選一問答。答錯了不會扣分，重新作答到答對為止。`,
  },
  {
    id: 'photo',
    text: `${countOf('photo')} 個景點：依題目拍一張場景照並上傳，上傳後就集章。主辦單位會從每個拍照關卡選出 3 張佳作，贈送活動市集餐券。`,
  },
  {
    id: 'fill',
    text: `${countOf('fill')} 個景點：先讀一段說明，再回答問題。開始作答後說明會收起來；想重看要按「回上一步」。答錯了重新作答。`,
  },
];

const faq = [
  { q: '要先下載 App 嗎？', a: '不需要。用手機瀏覽器掃描 QR Code、打開集章冊就能玩。' },
  {
    q: '沒有網路可以集章嗎？',
    a: '不行。驗章、上傳照片與兌獎都需要連線，現場請保持網路暢通。',
  },
  {
    q: '掃不到 QR Code 怎麼辦？',
    a: '在集章冊的「輸入集章點代碼」欄位，輸入 QR Code 下方印的代碼。',
  },
  {
    q: '換手機或清除瀏覽器資料，進度會不見嗎？',
    a: '不會。進度存在伺服器，用同一個帳號登入就能繼續。',
  },
  {
    q: '要用學校帳號登入嗎？',
    a: '目前以帳號與密碼註冊及登入，學校帳號等單一登入（SSO）尚未串接。集章與兌獎紀錄存在伺服器。',
  },
  {
    q: '忘記密碼怎麼辦？',
    a: '目前尚無自助找回密碼的功能，請在註冊時妥善保存密碼。',
  },
];

export default function PlayPage() {
  useDocumentTitle(display.pages.play);
  // An old QR link may still land here; send the claim on to the stamp book.
  const [params] = useSearchParams();
  const claim = readClaim(params);
  const spot = getSpot(claim?.spot ?? null);

  return (
    <Page
      title={display.pages.play}
      lede={`第二屆松櫻祭的大地遊戲是走遍「新中大十景」的實景集章：掃 QR Code、玩關卡小遊戲、解鎖景點知識，集章換獎勵。用手機瀏覽器就能開始。`}
      className="play"
    >
      {spot && claim ? (
        <section className="claim" aria-labelledby="claim-title">
          <h2 id="claim-title">待驗證集章點「{spot.name}」</h2>
          <p>
            這是你掃到的集章點，登入後由伺服器確認代碼與任務。集章冊沒有自動帶入時，輸入代碼{' '}
            <strong className="latin">{claim.key}</strong>。
          </p>
          <Link className="button" to={`/?${params}`}>
            前往集章冊
            <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <div className="actions">
          <Link className="button" to="/">
            打開集章冊
            <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
          </Link>
          <Link className="button button-ghost" to="/map">
            <MapTrifoldIcon size={18} aria-hidden="true" />
            看集章地圖
          </Link>
        </div>
      )}

      <section aria-labelledby="steps-title">
        <h2 className="display section-title" id="steps-title">
          {display.sections.howToPlay}
        </h2>
        <ol className="rows steps">
          {steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="how-title">
        <h2 className="display section-title" id="how-title">
          {display.sections.howStamp}
        </h2>
        {/* 印章: the three task types, each as a seal. */}
        <ol className="seal-methods">
          {methods.map((method) => (
            <li key={method.id}>
              <span className="display seal cone" aria-hidden="true">
                {display.flows.seals[method.id]}
              </span>
              <h3>{methodLabels[method.id]}</h3>
              <p>{method.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="spots-title">
        <h2 className="display section-title" id="spots-title">
          {display.sections.spots}
        </h2>
        <p>點任一景點，在集章地圖上看它的位置與介紹。</p>
        <ol className="spot-list">
          {stampSpots.map((item) => (
            <li key={item.id}>
              <Link className="spot-link" to={`/map?spot=${item.id}`}>
                <span className="display spot-seal cone" aria-hidden="true">
                  {display.flows.seals[item.method]}
                </span>
                <span>
                  <span className="spot-name">
                    <span className="latin stamp-no">{item.no}</span>
                    {item.name}
                  </span>
                  <span className="spot-method">{methodLabels[item.method]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="note">
          另一景{lulin.name}位於{lulin.place.split('・')[0]}，不設集章點，可在集章地圖上閱讀介紹。
        </p>
      </section>

      <section aria-labelledby="prize-title">
        <h2 className="display section-title" id="prize-title">
          {display.sections.prize}
        </h2>
        <ol className="rows milestones">
          {(['meal', 'merch'] as const).map((tier) => (
            <li key={tier}>
              <span className="latin milestone-at">{prizes[tier].need}</span>
              <p>
                集滿 {prizes[tier].need} 個章，可兌換<strong>{prizes[tier].name}</strong>（前{' '}
                {prizes[tier].stock} 名）。
              </p>
            </li>
          ))}
        </ol>
        <ul className="rows dotted">
          <li>集章冊出現兌獎碼後，到兌獎處出示，由工作人員核銷領取。</li>
          <li>兩樣獎品都可以領，每樣每人限一次；先兌先得，兌完為止。</li>
          <li>
            拍照關卡另有佳作獎：主辦單位會從每個拍照關卡選出 3
            張拍得最好的照片，贈送當天活動市集的餐券；獲選名單會公告在松櫻祭官方粉專。
          </li>
        </ul>
        <p className="note">兌獎處的位置與開放時間待公布。</p>
      </section>

      <section id="privacy" aria-labelledby="privacy-title">
        <h2 className="display section-title" id="privacy-title">
          {display.sections.privacy}
        </h2>
        <ul className="rows dotted">
          <li>
            拍照關卡的照片會在你同意後上傳並保存，只用於主辦單位評選各關卡佳作、發放市集餐券，不作其他用途，也不會公開。
          </li>
          <li>只有已登入的工作人員能看到照片。</li>
          <li>請拍指定的場景，避免拍到其他人的臉；如果不小心拍到人，請重拍再上傳。</li>
          <li>照片會先在你的手機縮小再上傳，上限 3 MB。</li>
        </ul>
        <p className="note">照片的保存期限與刪除方式待主辦單位公告。正式隱私權政策待確認後公布。</p>
      </section>

      <section aria-labelledby="faq-title">
        <h2 className="display section-title" id="faq-title">
          {display.sections.faq}
        </h2>
        <div className="faq">
          {faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </Page>
  );
}
