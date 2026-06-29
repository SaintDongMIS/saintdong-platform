import type { TutorialLesson } from '~/types/tutorial';

/**
 * 內容依據 COMMEET 官方教學影片：
 * https://www.youtube.com/watch?v=VPgGnApvJS8
 */
export const commmeetGeneral02: TutorialLesson = {
  slug: 'commmeet-general-02',
  seriesId: 'commmeet-general',
  episode: 2,
  title: '系統內三種最常使用表單的介紹',
  subtitle: 'COMMEET 系統操作教學 通用篇（二）',
  description:
    '掌握費用報銷單、費用申請單與預先付款單的應用場景與對應關係，讓報支流程更加流暢準確。',
  audience: ['all'],
  status: 'published',
  estimatedMinutes: 4,
  video: {
    youtubeId: 'VPgGnApvJS8',
    title: 'COMMEET 系統操作教學 通用篇（二）系統內三種最常使用表單的介紹',
    channel: 'COMMEET 智能費用管理系統',
    duration: '3:57',
    url: 'https://www.youtube.com/watch?v=VPgGnApvJS8',
  },
  /** 時間點依影片實際段落對齊（手動逐段對照） */
  videoChapters: [
    { id: 'er', code: 'ER', title: '費用報銷單', startSeconds: 26 },
    { id: 'ea', code: 'EA', title: '費用申請單', startSeconds: 68 },
    { id: 'pe', code: 'PE', title: '預先付款單', startSeconds: 116 },
    { id: 'doc-number', title: '辨識表單編號', startSeconds: 192 },
  ],
  keyPoints: [
    {
      order: 1,
      code: 'ER',
      title: '費用報銷單',
      summary: '最常見的報支表單，適用於「已有憑證」的報銷場景。',
      icon: 'reimbursement',
      videoStartSeconds: 26,
      videoChapterId: 'er',
    },
    {
      order: 2,
      code: 'EA',
      title: '費用申請單',
      summary: '適用於「費用發生前」的事前申請，取得核可後再採購。',
      icon: 'application',
      videoStartSeconds: 68,
      videoChapterId: 'ea',
    },
    {
      order: 3,
      code: 'PE',
      title: '預先付款單',
      summary: '適用於「需先付貨款，後拿發票」的情境。',
      icon: 'prepayment',
      videoStartSeconds: 116,
      videoChapterId: 'pe',
    },
  ],
  forms: [
    {
      code: 'ER',
      name: '費用報銷單',
      tagline: '已有憑證 → 完成請款',
      whenToUse: '當你手上已經有發票、收據或其他憑證時使用。',
      scenarios: [
        '員工自行代墊，事後憑發票報銷',
        '廠商已開立發票，直接請款',
        '國內外發票、收據、車票等憑證報支',
      ],
      highlights: [
        '最常見、使用頻率最高的表單',
        '憑證齊全即可發起報銷流程',
        '適合「先花錢、後報帳」或「廠商已開票」的情境',
      ],
      accent: 'blue',
      icon: 'reimbursement',
    },
    {
      code: 'EA',
      name: '費用申請單',
      tagline: '費用發生前 → 事前申請',
      whenToUse: '在實際支出發生之前，先向主管申請並取得核可。',
      scenarios: [
        '採購前先申請預算與用途',
        '出差、活動等需事前核准的支出',
        '確保支出符合部門預算規劃',
      ],
      highlights: [
        '先申請、後執行，避免超支',
        '主管核可後再進行採購或支出',
        '後續報銷時可向前勾稽，確保合規',
      ],
      accent: 'emerald',
      icon: 'application',
    },
    {
      code: 'PE',
      name: '預先付款單',
      tagline: '先付款 → 後拿發票 → 再核銷',
      whenToUse: '交易需要先付貨款，但發票尚未取得時使用。',
      scenarios: [
        '訂金、預付貨款等先款後票交易',
        '由會計先行出帳付款',
        '取得憑證後回原單據轉報銷單核銷',
      ],
      highlights: [
        '解決「無發票先付款」的流程斷點',
        '可勾稽費用申請單，維持預算控管',
        '後續轉報銷單完成費用閉環',
      ],
      accent: 'amber',
      icon: 'prepayment',
    },
  ],
  tips: [
    '詳細的界面點擊與勾稽操作流程，請參考後續的操作教學影片。',
    '表單編號開頭字母（EA、ER、PE）可快速辨識單據種類。',
    '編號後續數字可協助判讀填單日期等資訊。',
    '若有使用問題，可至 COMMEET 幫助中心查閱更多說明。',
  ],
  helpCenterUrl: 'https://go-commeet.zendesk.com/hc/zh-tw',
  prevSlug: 'commmeet-general-01',
  nextSlug: 'commmeet-general-03',
};
