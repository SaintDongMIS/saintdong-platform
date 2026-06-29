import type { TutorialLesson } from '~/types/tutorial';

/**
 * 內容依據 COMMEET 官方教學影片：
 * https://www.youtube.com/watch?v=ML-TKSCslhk
 */
export const commmeetGeneral03: TutorialLesson = {
  slug: 'commmeet-general-03',
  seriesId: 'commmeet-general',
  episode: 3,
  title: '費用申請單與費用報銷單',
  subtitle: 'COMMEET 系統操作教學 通用篇（三）',
  description:
    '手把手示範從費用申請單 (EA) 發起，到取得憑證後以費用報銷單 (ER) 往前勾稽的完整流程。',
  audience: ['all'],
  status: 'published',
  estimatedMinutes: 8,
  video: {
    youtubeId: 'ML-TKSCslhk',
    title: 'COMMEET 系統操作教學 通用篇（三）費用申請單與費用報銷單',
    channel: 'COMMEET 智能費用管理系統',
    duration: '7:24',
    url: 'https://www.youtube.com/watch?v=ML-TKSCslhk',
  },
  /** 時間點依影片實際段落對齊（手動逐段對照） */
  videoChapters: [
    { id: 'ea-create', code: 'EA', title: '發起費用申請單', startSeconds: 36 },
    { id: 'approval', title: '簽核進度追蹤', startSeconds: 57 },
    { id: 'er-flow', title: '走報銷流程', startSeconds: 160 },
    { id: 'er-link', code: 'ER', title: '費用報銷單勾稽', startSeconds: 220 },
    { id: 'ocr', title: 'OCR 憑證辨識', startSeconds: 265 },
    { id: 'payment', title: '付款對象與方式', startSeconds: 405 },
  ],
  keyPoints: [
    {
      order: 1,
      code: 'EA',
      title: '發起費用申請單',
      summary:
        '選定費用歸屬、填寫必填欄位與事由，完成 EA 送單。',
      icon: 'application',
      videoStartSeconds: 36,
      videoChapterId: 'ea-create',
    },
    {
      order: 2,
      title: '簽核進度追蹤',
      summary:
        '透過訊息中心與表單清單，查看 EA 的簽核狀態與核准結果。',
      icon: 'navigation',
      videoStartSeconds: 57,
      videoChapterId: 'approval',
    },
    {
      order: 3,
      title: '走報銷流程',
      summary:
        'EA 核准後，從表單清單或訊息中心進入報銷，開始建立 ER。',
      icon: 'navigation',
      videoStartSeconds: 160,
      videoChapterId: 'er-flow',
    },
    {
      order: 4,
      code: 'ER',
      title: '費用報銷單勾稽',
      summary:
        '開啟「我要勾稽費用申請單」，將已核准 EA 帶入 ER，並確認防重報機制。',
      icon: 'reimbursement',
      videoStartSeconds: 220,
      videoChapterId: 'er-link',
    },
  ],
  formsSectionTitle: '兩種表單操作詳解',
  forms: [
    {
      code: 'EA',
      name: '費用申請單',
      tagline: '費用發生前 → 事前申請核可',
      whenToUse:
        '在實際支出或採購發生前，先建立 EA 取得主管核准與預算確認。',
      scenarios: [
        '從主選單或快速新增路徑建立 EA',
        '選定費用歸屬（部門／專案），注意多部門資料不互通',
        '填寫申請明細、時程與事由後送出簽核',
      ],
      highlights: [
        '必填欄位需完整填寫，避免簽核退件',
        '事由描述越清楚，後續查找與勾稽越有效率',
        '核准後才可進入 ER 勾稽報銷',
      ],
      accent: 'emerald',
      icon: 'application',
      videoChapterId: 'ea-create',
    },
    {
      code: 'ER',
      name: '費用報銷單',
      tagline: '取得憑證 → 勾稽 EA → 完成報銷',
      whenToUse:
        '實際支出完成並取得發票或收據後，建立 ER 並勾稽對應的 EA。',
      scenarios: [
        '勾選「我要勾稽費用申請單」，選取已核准 EA',
        '點擊「帶入」將 EA 明細快速填入 ER',
        '上傳憑證、設定付款對象後送出報銷',
      ],
      highlights: [
        '勾稽後可查看 EA 預算水位，避免超支',
        '「已報銷」欄位可確認 EA 是否重複使用',
        '支援 OCR 自動辨識電子發票欄位',
      ],
      accent: 'blue',
      icon: 'reimbursement',
      videoChapterId: 'er-link',
    },
  ],
  tips: [
    '若不熟悉 EA、ER 差異，建議先觀看通用篇（二）了解表單定義。',
    '身兼多部門的同仁，填單時請確認所選部門，不同部門申請單資訊獨立不互通。',
    'OCR 辨識後請校對統編、金額與憑證類別；國外憑證需手動選擇正確類別。',
    '付款對象可選員工代墊、供應商名單，或自行輸入廠商資訊。',
  ],
  helpCenterUrl: 'https://go-commeet.zendesk.com/hc/zh-tw',
  prevSlug: 'commmeet-general-02',
  nextSlug: 'commmeet-general-05',
};
