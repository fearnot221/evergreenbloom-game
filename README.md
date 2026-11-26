# 松櫻祭 · 集章網站

獨立於 [官網](https://github.com/fearnot221/evergreenbloom-website) 的集章服務。
只有一份部署設定：**docker-compose.yml**。一個 Node 24 容器同時提供前端與 API，
使用內建 SQLite，資料庫及待審照片保存在 named volume game-data。
沒有額外的 Compose profile、override、資料庫服務或套件依賴。

## 啟動

    cp .env.example .env

在 .env 填入：

- ADMIN_USERNAME：系統管理員的帳號 ID（Google 登入後設定的 ID），預設 fearnot221。
  管理員在 /staff 管理工作人員名單。這個 ID 若還沒有人設定，第一個設定它的 Google 帳號
  就是管理員，所以部署後請管理員先登入設定。
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET：唯一的登入方式，見下方「登入與權限」。
- STAMP_KEYS：JSON 物件，新中大十景每個集章點一個各不相同的現場代碼（16 至 80 個大寫英數或連字號）：zhongda-road、tingsong、main-library、chungcheng-library、baihua、auditorium、zhongda-lake、friendship-sakura、csrsr-station、taichi。
  每個代碼為 16 至 80 個大寫英數或連字號；可各執行一次 openssl rand -hex 16
  並轉成大寫。不要把代碼或 .env 提交至公開 repo。
- APP_ORIGIN：瀏覽器實際使用的完整 origin，不含結尾斜線。預設 http://localhost:8080 。
  正式環境必須是 HTTPS，例如 https://play.example.org （尚未指定正式網址）。
- GAME_PORT：本機映射埠，預設 8080。若修改，APP_ORIGIN 的埠也要對應。
- VITE_WEBSITE_URL：官網網址；這一項改動需要重新建置前端。

    docker compose up -d --build --wait
    docker compose logs -f

開啟 http://localhost:8080/ ，用 Google 登入並集章；/play 是集章說明。
工作人員同樣用 Google 登入 /staff，權限由管理員在名單中指定。
啟動時未設定現場代碼會直接失敗，不會默默使用公開測試值。

正式伺服器需自行設定 HTTPS 反向代理，轉送至本機埠。預設僅綁定 loopback；
不會將未加密 API 或資料庫埠開放到外網。代理不得改寫瀏覽器的 Origin。
確定正式集章網址後，再設定官網的 VITE_GAME_URL 並重部署官網。

## 登入與權限

沒有帳號密碼登入，所有人都用 Google 登入，新帳號一律是 player。登入使用隨機 HttpOnly、
SameSite=Lax Cookie，資料庫只保存 session token 雜湊，有效期 7 天。
HTTPS origin 會加上 Secure。登出立即撤銷該 session；不能以客戶端送出的角色或
user ID 冒充工作人員。所有寫入 API 要求正確 Origin，並有基本頻率與大小限制。

ADMIN_USERNAME 指定的帳號 ID 是系統管理員，本身有工作人員權限，並可在 /staff
新增或移除工作人員（GET/POST /api/admin/staff）。對方須先用 Google 登入並設定 ID；
加入或移除立即生效。工作人員不參加集章兌獎。舊版的帳密工作人員帳號已無法登入，
啟動時會撤銷其 session。

Google 登入（唯一的登入方式，未設定時沒有人能登入）：設定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET（Google Cloud
Console 建立「網頁應用程式」OAuth 用戶端，已授權的重新導向 URI 填
`<APP_ORIGIN>/api/auth/google/callback`）後，登入表單會出現「使用 Google 登入」。
伺服器端 authorization code 流程，含 state 與 PKCE，只要求 `openid` scope；
`identities` 表以 Google `sub` 對應一個參加者帳號（隨機帳號名 `g-…`，無密碼），
不保存 email 或姓名。沒有註冊或密碼登入 API；
第一次登入須設定 8–16 位英數帳號 ID 與暱稱。
學校帳號 SSO 尚未串接，沒有自助找回密碼或 email 流程。不同帳號可能屬於同一個人；現階段限制的是
**每個帳號一次**，不宣稱能辨識自然人。

## 驗章與兌獎

現場 QR：<集章網址>/stamp/<spot>?k=<private-code>。
既有 LAKE-26 / BOOK-26 / GATE-26 公開示範碼已停用；請在設定新代碼後重新製作 QR。

- 掃碼：伺服器檢查該點代碼，再寫入自己的集章紀錄。
- 問答：代碼及答案都由伺服器核對；正解不再打包到前端。
- 拍照：使用者明確同意後，上傳 JPEG / PNG / WebP，最多 3 MB；伺服器檢查檔頭與
  大小，先列待審。工作人員在 /staff 查看照片並通過，才由伺服器發章。
  檔頭檢查不代表內容符合任務，仍須人工確認。退回可重傳；重傳會換審核 ID，
  避免舊照片的畫面批准到新照片。
- 照片通過或退回時移除影像欄位，保留狀態、同意時間、審核帳號與時間。
  逾 7 天未處理的照片在 API 請求或每小時清理時退回並移除影像。
  資料庫舊頁面、WAL 或備份仍需依主辦單位保存政策處理，不能當成實體抹除承諾。
- 集滿所有伺服器有效章後顯示隨機兌獎碼。工作人員先查詢資格、確認發放，再核銷。
  伺服器交易重新檢查資格，並以 UNIQUE(user_id) 保證重送或同時核銷仍只留一筆。
  紀錄含編號、參加者、伺服器時間、核銷帳號與章數；無刪改紀錄的 API。
  工作人員頁顯示最近 100 筆，完整歷史仍在資料庫。

章、session、照片與兌獎 API 全部 no-store。這是一般網站，不是 PWA：沒有 manifest、
安裝或離線快取，離線時不會發章、核銷或先顯示假成功。public/sw.js 只負責移除舊版 PWA
的 worker 與 songying-core-* / songying-shell-* 快取，不攔截任何請求；舊版使用者連線
開啟網站後即會清除。已加入主畫面的舊捷徑可直接刪除，改用瀏覽器開啟。
舊版 localStorage 章不匯入有效紀錄。

現場代碼只證明持有代碼，不能防止拍照轉傳或保證實際到場。位置、題目與獎品仍待
主辦單位確認；目前只有「集滿全部章、每帳號一次」的一種兌獎規則。

## 資料保存與備份

docker compose down 不刪除 named volume；重新建立容器仍保留帳號、章與兌獎紀錄。
**不要執行 docker compose down -v**，那會刪除資料。
本服務是單一實例；不要讓多個容器在網路檔案系統共用同一份 SQLite。

連線中的資料庫請用 SQLite backup API 產生一致快照，不要直接複製主檔而漏掉 WAL：

    docker compose exec -T game node --input-type=module -e "import {DatabaseSync,backup} from 'node:sqlite'; const db=new DatabaseSync('/data/game.sqlite'); await backup(db,'/data/backup.sqlite'); db.close();"
    docker compose cp game:/data/backup.sqlite ./backup.sqlite

備份含帳號雜湊、進度、待審照片與兌獎紀錄，應受限存放並依保存政策清理。
還原前停止寫入，保存原始檔及 WAL，再從一致快照還原；不要覆蓋執行中的資料庫。

## 開發與驗證

    npm ci
    npm run check
    npm run build

Node 24 是必要條件；較早的 Node 24 仍會提示 SQLite / type stripping 實驗警告。
本機後端可用 DATABASE_PATH=/tmp/songying-dev.sqlite npm run server 啟動在 8080；
另開 npm run dev。Vite 只轉譯由其本機頁面發出的 Origin，代理到預設後端。
前後端使用一致 origin 後，也可直接以 Docker 驗證。

測試包含帳密、角色拒絕、CSRF、無效代碼／答案、照片審核與重傳競態、
重複集章、同時兌獎、session 到期／撤銷、重啟保存、照片清理及一致快照。
CI 使用同一份 docker-compose.yml 建置並啟動；工作流程中的帳密及代碼僅為 CI 測試值。

設計見 docs/DESIGN.md；目前架構見 docs/ARCHITECTURE.md；
實測結果見 docs/PROTOTYPE-NOTES.md。歷史紀錄不是目前產品的完整功能清單。

## 集章點代碼與作弊風險

現場代碼（STAMP_KEYS）是集章的唯一到場證明。代碼整個活動不變時，只要有人把集章牌照片
貼到網路上，別人就能在家集滿十個章，搶走限量獎品。建議每個活動日換一組新代碼：

1. 產生十組新的代碼（每組 16 至 80 個大寫英數或連字號，彼此不同）。
2. 更新正式主機 `.env` 的 STAMP_KEYS，執行 `docker compose up -d` 重新啟動。
3. 換上印有當日 QR Code 與代碼的集章牌。

已集到的章不受影響；只有舊代碼無法再集新章。

## 照片保存期限

拍照關卡的照片存在資料庫裡，供主辦單位評選佳作。訂好保存期限後，在 `.env` 設定
`PHOTO_RETENTION_DAYS`（天數），伺服器會在啟動時與每小時刪除超過期限、未被選為佳作的照片；
選為佳作的照片與所有已集的章都會保留。未設定（0）時照片不會自動刪除。
