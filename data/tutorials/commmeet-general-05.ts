import type { TutorialLesson } from '~/types/tutorial';

/**
 * 內容依據 COMMEET 官方教學影片：
 * https://www.youtube.com/watch?v=yAVsx2adjrA
 */
export const commmeetGeneral05: TutorialLesson = {
  slug: 'commmeet-general-05',
  seriesId: 'commmeet-general',
  episode: 5,
  title: '手機與電腦申請費用報銷單',
  subtitle: 'COMMEET 系統操作教學 通用篇（五）',
  description: '跨裝置申請費用報銷單的操作示範。',
  audience: ['all'],
  status: 'published',
  estimatedMinutes: 5,
  video: {
    youtubeId: 'yAVsx2adjrA',
    title: 'COMMEET 系統操作教學 通用篇（五）手機與電腦申請費用報銷單',
    channel: 'COMMEET 智能費用管理系統',
    duration: '4:15',
    url: 'https://www.youtube.com/watch?v=yAVsx2adjrA',
  },
  /** 時間點依影片逐秒抽幀對齊（yAVsx2adjrA，全片 255s） */
  videoChapters: [
    { id: 'mobile-app', title: '手機 App 操作界面', startSeconds: 36 },
    { id: 'mobile-er', code: 'ER', title: '發起費用報銷單', startSeconds: 63 },
    { id: 'mobile-photo', title: '拍照上傳憑證', startSeconds: 109 },
    { id: 'ocr', title: 'OCR 辨識帶入', startSeconds: 127 },
    { id: 'save-draft', title: '儲存暫不送出', startSeconds: 190 },
    { id: 'desktop-continue', title: '電腦接續編輯', startSeconds: 211 },
    { id: 'desktop-submit', title: '電腦送出簽核', startSeconds: 232 },
  ],
  keyPoints: [
    {
      order: 1,
      title: '手機 App 操作界面',
      summary:
        '輸入企業網址登入 App，設定生物辨識，並從主頁表單申請入口進入費用報銷。',
      icon: 'navigation',
      videoStartSeconds: 36,
      videoChapterId: 'mobile-app',
    },
    {
      order: 2,
      code: 'ER',
      title: '手機申請費用報銷單',
      summary:
        '無須勾稽申請單即可發起 ER，支援拍照、裁切與 OCR 自動帶入發票資訊。',
      icon: 'reimbursement',
      videoStartSeconds: 63,
      videoChapterId: 'mobile-er',
    },
    {
      order: 3,
      title: '手機與電腦同步編輯表單',
      summary:
        '手機先「儲存暫不送出」，回到辦公室後於電腦版報銷清單接續編輯並送出。',
      icon: 'login',
      videoStartSeconds: 190,
      videoChapterId: 'save-draft',
    },
  ],
  formsSectionTitle: '跨裝置操作詳解',
  forms: [
    {
      code: '手機',
      name: '手機 App 操作界面',
      tagline: '隨身拍照 → 即時建單',
      whenToUse:
        '出差、外勤或收到發票當下，先用手機 App 快速登入並建立報銷草稿。',
      scenarios: [
        '首次開啟 App，輸入企業網址（如 bimgroup.commeet.co）後進入',
        '於設定開啟生物辨識（Face ID／指紋）加速登入',
        '從主頁「表單申請」選擇費用報銷單',
        '填寫費用歸屬等基本欄位後進入明細步驟',
      ],
      highlights: [
        '行動版介面精簡，適合零碎時間處理',
        '主頁提供快速申請入口與功能選單',
        '與電腦版帳號資料即時同步',
      ],
      accent: 'violet',
      icon: 'navigation',
      videoChapterId: 'mobile-app',
      mockup: 'commmeet-app-url',
      mockupCaption: '請輸入你的企業網址，點右側箭頭進入',
      mockupProps: { companyUrl: 'bimgroup.commeet.co' },
    },
    {
      code: 'ER',
      name: '手機拍照報銷',
      tagline: '拍照 OCR → 一鍵帶入',
      whenToUse:
        '已有發票或收據時，直接以手機拍照建立 ER，無須先勾稽 EA。',
      scenarios: [
        '選擇費用項目後，以「掃描／選取」上傳憑證',
        '拍照後裁切範圍，確認 OCR 辨識的日期、金額與統編',
        '點擊「帶入報銷資訊」將明細加入報銷單',
      ],
      highlights: [
        '適合在外奔波、需即時處理零星收據的場景',
        'OCR 自動帶入欄位，減少手動輸入錯誤',
        '辨識後請校對買方統編與金額是否正確',
      ],
      accent: 'blue',
      icon: 'reimbursement',
      videoChapterId: 'mobile-photo',
    },
    {
      code: '同步',
      name: '跨裝置同步編輯',
      tagline: '手機暫存 → 電腦送單',
      whenToUse:
        '手機先完成拍照與基本填寫，回辦公室後改用電腦大螢幕校對並送出。',
      scenarios: [
        '手機填寫完成後點「儲存暫不送出」保留草稿',
        '電腦登入後，於費用報銷清單找到狀態「未提出」的單據',
        '接續編輯事由、付款對象後於電腦版送出簽核',
      ],
      highlights: [
        '結合手機即時性與電腦完整操作體驗',
        '暫存單據跨裝置即時同步，資訊不遺漏',
        '建議收到發票當下先拍照儲存，避免憑證遺失',
      ],
      accent: 'emerald',
      icon: 'login',
      videoChapterId: 'desktop-continue',
    },
  ],
  tips: [
    '收到發票的第一時間建議先用手機 App 拍照儲存，待空檔再回電腦端統一送出簽核。',
    '本集示範「不勾稽申請單」的直接報銷；若需勾稽 EA，請參考通用篇（三）。',
    'OCR 辨識後請務必校對統編、金額與憑證類別，國外憑證需手動選擇正確類別。',
    '手機 App 可至 iOS／Android 商店下載；安裝或使用問題請至幫助中心查詢。',
  ],
  helpCenterUrl: 'https://go-commeet.zendesk.com/hc/zh-tw',
  prevSlug: 'commmeet-general-03',
  nextSlug: 'commmeet-general-06',
};
