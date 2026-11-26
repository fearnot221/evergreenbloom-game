// 新中大十景: the stamp spots, their tasks and the knowledge shown after each task.
// Supplied by the team on 2026-11-12. Answers and station codes are server-only
// (server/app.mjs, STAMP_KEYS); this file ships to the browser.
//
// Positions are [longitude, latitude] for the stamp map. `approx` marks spots placed
// from the team's description ("正門左側", "中大湖畔") next to OpenStreetMap features,
// not from a survey; confirm them on site before printing a map.
export type StampMethod = 'quiz' | 'photo' | 'fill';

export interface StampSpot {
  id: string;
  /** The spot's number in 新中大十景 (鹿林天文台 keeps 10 but is not a stamp). */
  no: number;
  name: string;
  method: StampMethod;
  /** quiz: the question; photo: what to photograph; fill: the question after the passage. */
  prompt: string;
  /** quiz only: the choices, in order (A, B, C). */
  options?: string[];
  /** fill only: the passage to read first, by paragraph. Hidden once the answer box opens. */
  passage?: string[];
  /** Shown after the task, before the stamp: the spot's knowledge. */
  intro: string;
  at: [number, number];
  approx?: boolean;
}

export const methodLabels: Record<StampMethod, string> = {
  quiz: '中大知識問答',
  photo: '拍場景照',
  fill: '讀說明找答案',
};

export const stampSpots: StampSpot[] = [
  {
    id: 'zhongda-road',
    no: 1,
    name: '中大路',
    method: 'quiz',
    prompt: '中大人的中大路，每逢春夏之交時，會盛開什麼花？',
    options: ['木棉花', '鳳凰花', '櫻花'],
    intro:
      '筆直的中大路，牌樓聳立，門誌鏗鏘。每逢春夏之交，木棉花開，如火焚燃，被譽為「北台灣最美的木棉花道」。',
    at: [121.1953, 24.9671],
    approx: true,
  },
  {
    id: 'tingsong',
    no: 2,
    name: '聽松台',
    method: 'photo',
    prompt: '請拍出一張你認為最美的聽松台。',
    intro:
      '正門左側景觀平台以「聽松」為名，松影搖曳其中，可聽松濤，可眺遠方美景，飽覽旖旎風光，與翼然車亭合成一體，與左側觀景台相映成趣。',
    at: [121.194, 24.9671],
    approx: true,
  },
  {
    id: 'main-library',
    no: 3,
    name: '總圖書館',
    method: 'quiz',
    prompt: '關於總圖書館，何者敘述正確？',
    options: ['位於校園後門口附近', '總共有 8 層樓', '為圓形大樓'],
    intro:
      '氣派雄偉的總圖書館，為校園裡的知識殿堂，人文輝光閃耀。館藏豐富，翰墨留芳，傳統與現代並存，理性與感性兼具。',
    at: [121.194263, 24.968316],
  },
  {
    id: 'chungcheng-library',
    no: 4,
    name: '中正圖書館',
    method: 'fill',
    passage: [
      '中正圖書館，中大的文化心臟。坐落於百花川畔，由知名建築師陳其寬校友設計，這座圖書館不只是知識的殿堂，更是藝術與文化的寶庫。',
      '館內珍藏豐富戲曲文物，並設有藝文中心，讓學術、人文、美感在此交融；在這裡，閱讀不只是學習，更是一場文化的傳承。',
      '隨著總圖書館落成，中正圖書館現已轉型為多功能空間，內部進駐多個重要單位與設施，例如學務處、服務學習中心等。',
    ],
    prompt: '中正圖書館是由哪位校友規劃設計？',
    intro:
      '綠白相間的中正圖書館，被稱為「舊圖」，由陳其寬校友規劃設計，依據井田棋盤的概念，位居校園核心，象徵知識的泉源。內有天井花園，稱「樂讀園」。',
    at: [121.1929, 24.9689],
    approx: true,
  },
  {
    id: 'baihua',
    no: 5,
    name: '百花川',
    method: 'quiz',
    prompt: '百花川是連接哪個水圳的引水渠道？',
    options: ['瑠公圳', '貓霧捒圳', '石門大圳'],
    intro:
      '百花川為連接石門大圳的引水渠道，橫貫校園，左側為學子上下課必經之路；右側為新建之百花川文學步道，十位文壇校友作品鑄刻其上，更添人文勝景。',
    at: [121.193293, 24.968308],
  },
  {
    id: 'auditorium',
    no: 6,
    name: '大禮堂',
    method: 'fill',
    passage: [
      '中央大學以「松」立校，因此新建的大禮堂以「松果」作為設計靈感，象徵孕育智慧的種籽。',
      '大禮堂外觀呈橢圓形，屋頂採用三種不同深淺的木質色鋁板，模擬松果鱗片的層次。',
      '建築透過玻璃帷幕引入自然陽光，讓人們能欣賞周圍美麗的松樹林。大禮堂內部則運用溫潤的木紋牆面與燈光設計，展現松果的立體感。',
    ],
    prompt: '中央大學的大禮堂是以什麼植物的果實作為設計靈感？',
    intro:
      '教學研究綜合大樓之大禮堂，外型採獨特的「松果」造型，運用櫛比鱗次的空間層次，表達深厚的知識內涵。內可容納 1,500 個座位，氣勢磅礡。',
    at: [121.192378, 24.968293],
  },
  {
    id: 'zhongda-lake',
    no: 7,
    name: '中大湖',
    method: 'photo',
    prompt: '請拍出你認為最美的中大湖景色。',
    intro:
      '就原埤塘順勢而建，中大湖景色絕美，湖光映碧；環湖步道，柳條拂衣；花開時節，逢例假日，遊客如織。',
    at: [121.191313, 24.970853],
  },
  {
    id: 'friendship-sakura',
    no: 8,
    name: '友好之櫻',
    method: 'photo',
    prompt: '在櫻花盛開時，請拍出你認為最美的櫻花景色。若櫻花尚未盛開，請與友好之櫻之碑合照一張。',
    intro:
      '中大湖畔旁的河津櫻，為本校與日本中央大學締結姐妹校所栽種，2011 年日本前首相海部俊樹來台命名。其花型高雅脫俗，深受民眾喜愛。',
    at: [121.1922, 24.9703],
    approx: true,
  },
  {
    id: 'csrsr-station',
    no: 9,
    name: '太遙中心接收站',
    method: 'quiz',
    prompt: '太遙中心資源衛星接收站擁有幾米碟型大天線？',
    options: ['10 米', '13 米', '5 米'],
    intro:
      '位於校園西南一隅的太遙中心資源衛星接收站，擁有 13 米碟型大天線，運用前瞻的科技，守護我們的國土和家園，為中央大學深具特色地標。',
    at: [121.1868, 24.9674],
    approx: true,
  },
  {
    id: 'taichi',
    no: 10,
    name: '太極銅雕',
    method: 'quiz',
    prompt: '有關太極銅雕，下列敘述何者錯誤？',
    options: ['位於文學院草坪內', '為當代雕塑大師朱銘的作品', '此作品富涵中國新興文化的精華'],
    intro:
      '位於文學院草坪內的太極銅雕，為當代雕塑大師朱銘的作品，「太極」為其早期的系列作品，富涵中國傳統文化的精華，為中大極具象徵的人文景觀，是學子和民眾休憩最佳場所。',
    at: [121.1943, 24.9691],
    approx: true,
  },
];

/**
 * 鹿林天文台: one of 新中大十景, on 鹿林前山 in 玉山國家公園, far outside campus. Not a
 * stamp; the map shows it as a point beyond the campus with its introduction.
 */
export const lulin = {
  name: '鹿林天文台',
  place: '玉山國家公園・鹿林前山 海拔 2,862 公尺',
  intro:
    '玉山國家公園境內，海拔 2,862 公尺的鹿林前山，中央大學設有全國最高的鹿林天文台，擁有全國最大口徑的望遠鏡，使得中央大學享有「最高學府」之美名。',
};

/** Progress milestones: a sakura shower at 3, then the two prizes. */
export const SHOWER_AT = 3;
export type PrizeTier = 'meal' | 'merch';
export const prizes: Record<PrizeTier, { need: number; name: string; stock: number }> = {
  meal: { need: 6, name: '松櫻祭當天餐券', stock: 100 },
  merch: { need: 10, name: '松櫻週邊', stock: 100 },
};
export const prizeTiers = Object.keys(prizes) as PrizeTier[];

export const getSpot = (id: string | null) => stampSpots.find((spot) => spot.id === id);
