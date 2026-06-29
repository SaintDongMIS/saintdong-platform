import type { TutorialLesson } from '~/types/tutorial';

/**
 * 內容依據 COMMEET 官方教學影片：
 * https://www.youtube.com/watch?v=WuQjS5omc88
 */
export const commmeetGeneral06: TutorialLesson = {
  slug: 'commmeet-general-06',
  seriesId: 'commmeet-general',
  episode: 6,
  title: '手機與電腦簽核單據',
  subtitle: 'COMMEET 系統操作教學 通用篇（六）',
  description: '在手機與電腦上簽核單據的操作方式。',
  audience: ['all'],
  status: 'published',
  estimatedMinutes: 6,
  video: {
    youtubeId: 'WuQjS5omc88',
    title: 'COMMEET 系統操作教學 通用篇（六）手機與電腦簽核單據',
    channel: 'COMMEET 智能費用管理系統',
    duration: '5:26',
    url: 'https://www.youtube.com/watch?v=WuQjS5omc88',
  },
  /** 時間點依影片逐秒抽幀對齊（WuQjS5omc88，全片 326s） */
  videoChapters: [
    { id: 'processed-forms', title: '已處理表單管理', startSeconds: 28 },
    { id: 'column-settings', title: '自定義欄位設定', startSeconds: 38 },
    { id: 'status-guide', title: '表單狀態解讀', startSeconds: 68 },
    { id: 'approval-history', title: '追蹤簽核歷程', startSeconds: 90 },
    { id: 'pending-review', title: '待簽核明細審核', startSeconds: 115 },
    { id: 'approve-reject', title: '同意或駁回', startSeconds: 155 },
    { id: 'add-step', title: '新增臨時關卡', startSeconds: 190 },
    { id: 'mobile-approval', title: '手機 App 簽核', startSeconds: 235 },
  ],
  keyPoints: [
    {
      order: 1,
      title: '電腦版已處理與簽核歷程',
      summary:
        '從表單簽核進入已處理分頁，自訂欄位並區分「已核准」與「待簽核」狀態，追蹤完整簽核歷程。',
      icon: 'navigation',
      videoStartSeconds: 28,
      videoChapterId: 'processed-forms',
    },
    {
      order: 2,
      title: '待簽核審核與決策',
      summary:
        '於待簽核清單開啟單據，檢視明細與憑證後執行同意或駁回，並填寫簽核意見。',
      icon: 'proxy',
      videoStartSeconds: 115,
      videoChapterId: 'pending-review',
    },
    {
      order: 3,
      title: '加簽與手機 App 簽核',
      summary:
        '跨部門會辦時新增臨時關卡；具簽核權限者亦可於手機 App 完成同等審核操作。',
      icon: 'login',
      videoStartSeconds: 190,
      videoChapterId: 'add-step',
    },
  ],
  formsSectionTitle: '簽核操作詳解',
  forms: [
    {
      code: '電腦',
      name: '電腦版簽核清單',
      tagline: '已處理 → 待簽核 → 歷程',
      whenToUse:
        '主管或簽核管理者於辦公室以電腦版批次檢視、追蹤與處理待簽單據。',
      scenarios: [
        '從側邊欄「單據審核」進入，切換「已處理」或「待簽核」分頁',
        '點齒輪圖示自訂清單欄位，快速掌握表單狀態',
        '開啟單據後於最下方檢視完整簽核歷程',
      ],
      highlights: [
        '「已核准」表示流程走完；「待簽核」代表您已簽但後續仍有關卡',
        '待簽核清單可依表單類型分頁篩選',
        '清單欄位可依個人需求調整顯示順序',
      ],
      accent: 'slate',
      icon: 'navigation',
      videoChapterId: 'processed-forms',
    },
    {
      code: '審核',
      name: '電腦版審核決策',
      tagline: '憑證審核 → 同意／駁回 → 加簽',
      whenToUse:
        '收到待簽單據時，需審核明細、憑證與系統警示後做出決策，或加簽其他單位。',
      scenarios: [
        '開啟待簽單據，左側查看申請人與簽核關卡，中間點擊憑證連結',
        '填寫簽核意見後點「同意」或「駁回」',
        '跨部門會辦時以「新增臨時關卡」指定執行單位',
      ],
      highlights: [
        '系統警示可輔助判斷憑證異常或重複',
        '駁回或加簽建議詳填說明，方便申請人理解',
        '加簽支援同意並加簽、移交核決權、徵詢意見等模式',
      ],
      accent: 'amber',
      icon: 'proxy',
      videoChapterId: 'pending-review',
    },
    {
      code: '手機',
      name: '手機 App 簽核',
      tagline: '待辦清單 → 憑證 → 即時簽核',
      whenToUse:
        '外出或無法使用電腦時，以手機 App 快速處理待簽單據。',
      scenarios: [
        '具簽核權限者主頁可見「簽核單據」入口，或從底部「簽核」分頁進入',
        '於待辦清單選擇費用報銷等類型，查看申請人與上傳憑證',
        '填寫簽核意見後執行同意、駁回或加簽，邏輯與電腦版相同',
      ],
      highlights: [
        '無簽核權限的帳號不會顯示簽核入口',
        '可查看簽核關卡進度與申請人詳細資訊',
        '行動版支援與電腦版相同的加簽模式',
      ],
      accent: 'violet',
      icon: 'login',
      videoChapterId: 'mobile-approval',
    },
  ],
  tips: [
    '本集面向簽核管理者；若需設定簽核代理人，請參考通用篇（一）。',
    '執行「駁回」或「加簽」時，建議於意見欄詳述原因，加速後續處理。',
    '「已處理」分頁的「待簽核」狀態代表您已簽完但流程尚未結束，勿與待辦混淆。',
    '手機 App 簽核功能與邏輯與電腦版一致，可依情境選擇裝置。',
  ],
  helpCenterUrl: 'https://go-commeet.zendesk.com/hc/zh-tw',
  prevSlug: 'commmeet-general-05',
};
