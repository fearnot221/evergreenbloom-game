/**
 * Every string set in the display face (Noto Sans TC Black subset). Pages take their
 * titles from here so the font subset stays small and complete.
 * Run `npm run fonts` after editing; a test fails if a character is missing.
 */
export const display = {
  flows: {
    /** The seal glyph for each task type. */
    seals: { quiz: '答', photo: '拍', fill: '填' },
  },
  pages: {
    notFound: '迷路了嗎',
    error: '暫時打不開',
    play: '遊戲玩法',
    game: '集章冊',
    stampMap: '集章地圖',
    staff: '兌獎核銷',
    stats: '活動數據',
  },
  sections: {
    faq: '常見問題',
    howToPlay: '集章流程',
    spots: '新中大十景',
    prize: '集章獎勵',
    privacy: '拍照與隱私',
    howStamp: '三種任務',
    stamped: '集章成功',
  },
} as const;
