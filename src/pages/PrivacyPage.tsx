import { Link } from 'react-router-dom';
import { Page, useDocumentTitle } from '../components/page';
import '../styles/pages.css';

const TITLE = '隱私權政策';

/* Written from what server/app.mjs stores today; update both together. */
export default function PrivacyPage() {
  useDocumentTitle(TITLE);
  return (
    <Page plainTitle={TITLE}>
      <section aria-labelledby="privacy-data">
        <h2 id="privacy-data">蒐集的資料</h2>
        <ul className="rows dotted">
          <li>
            <strong>帳號：</strong>
            你第一次登入時設定的帳號 ID。所有帳號都用 Google 登入，不設密碼。
          </li>
          <li>
            <strong>Google 登入：</strong>
            只向 Google 要求基本的身分識別（openid），只保存 Google 提供的帳號識別碼，用來讓同一個
            Google 帳號登入同一個集章帳號。不保存 email、姓名或大頭貼，也不讀取其他 Google 資料。
          </li>
          <li>
            <strong>暱稱：</strong>你自行設定的暱稱，可隨時修改或清除。
          </li>
          <li>
            <strong>集章與兌獎紀錄：</strong>
            完成的集章點與時間、兌獎碼，以及工作人員兌換獎品的紀錄（時間、經手人員、當時集章數）。
          </li>
          <li>
            <strong>照片：</strong>
            拍照關卡的照片在你同意後上傳並保存，連同同意時間。只有已登入的工作人員能看到，用於評選各關卡佳作、發放市集餐券，不公開、不作其他用途。
          </li>
          <li>
            <strong>Cookie：</strong>
            一個必要的 Cookie 維持登入，有效 7 天，登出立即失效；Google 登入過程另用一個 10
            分鐘內失效的 Cookie 防止偽造請求。沒有廣告、分析或追蹤 Cookie。
          </li>
          <li>
            <strong>連線資訊：</strong>為防止濫用，伺服器會短暫使用 IP
            位址計算請求頻率，不寫入資料庫。
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-use">
        <h2 id="privacy-use">使用、分享與保存</h2>
        <ul className="rows dotted">
          <li>以上資料只用於經營集章活動、確認任務與兌換獎品。</li>
          <li>不出售、不出租，也不提供給第三方；不用於廣告。</li>
          <li>
            資料存放在主辦單位管理的伺服器。未獲選照片的保存期限，以及活動結束後的資料刪除時間，待主辦單位公告。
          </li>
          <li>
            若要查詢、更正或刪除你的資料，或撤回照片使用的同意，請透過第二屆松櫻祭的官方社群聯繫主辦單位。
          </li>
        </ul>
        <p className="note">
          最後更新：2026 年 11 月 26 日。本政策如有修改，會更新本頁與最後更新日期。玩法說明請見
          <Link className="text-link" to="/play">
            遊戲玩法
          </Link>
          。
        </p>
      </section>
    </Page>
  );
}
