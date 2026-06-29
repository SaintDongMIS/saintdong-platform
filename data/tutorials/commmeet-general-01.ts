import type { TutorialLesson } from '~/types/tutorial';

/**
 * 內容依據 COMMEET 官方教學影片：
 * https://www.youtube.com/watch?v=65Zb98rL-qg
 */
export const commmeetGeneral01: TutorialLesson = {
  slug: 'commmeet-general-01',
  seriesId: 'commmeet-general',
  episode: 1,
  title: '首次登入與簽核代理人設定',
  subtitle: 'COMMEET 系統操作教學 通用篇（一）',
  description:
    '學習首次登入 COMMEET 系統，以及設定簽核代理人模式。',
  audience: ['all'],
  status: 'published',
  estimatedMinutes: 5,
  video: {
    youtubeId: '65Zb98rL-qg',
    title: 'COMMEET 系統操作教學 通用篇（一）首次登入與簽核代理人設定',
    channel: 'COMMEET 智能費用管理系統',
    duration: '4:22',
    url: 'https://www.youtube.com/watch?v=65Zb98rL-qg',
  },
  /** 時間點依影片實際段落對齊（手動逐段對照） */
  videoChapters: [
    { id: 'login', title: '如何登入', startSeconds: 12 },
    { id: 'navigation', title: '主畫面導覽與通知設定', startSeconds: 28 },
    { id: 'proxy', title: '代理人功能說明', startSeconds: 94 },
    { id: 'proxy-submit', title: '代替送單模式', startSeconds: 178 },
  ],
  keyPoints: [
    {
      order: 1,
      title: '如何登入',
      summary: '使用公司 Email 登入，並了解忘記密碼時的 Email 重設流程。',
      icon: 'login',
      videoStartSeconds: 12,
      videoChapterId: 'login',
    },
    {
      order: 2,
      title: '主畫面導覽 & 通知設定',
      summary: '熟悉主畫面各區塊、訊息中心，以及個人 Email 通知偏好。',
      icon: 'navigation',
      videoStartSeconds: 28,
      videoChapterId: 'navigation',
    },
    {
      order: 3,
      title: '代理人功能說明',
      summary: '設定送單代理人與簽核代理人，並了解代替送單模式的操作方式。',
      icon: 'proxy',
      videoStartSeconds: 94,
      videoChapterId: 'proxy',
    },
  ],
  formsSectionTitle: '各段操作詳解',
  forms: [
    {
      code: '登入',
      name: '帳號登入與密碼重設',
      tagline: '首次進入 COMMEET → 完成登入',
      whenToUse:
        '收到 COMMEET 帳號開通信後，第一次登入系統，或需要重設密碼時。',
      scenarios: [
        '使用公司 Email 與初始密碼登入',
        '忘記密碼時，透過 Email 重設連結設定新密碼',
        '登入後確認個人基本資料是否正確',
      ],
      highlights: [
        '請使用公司核發的 Email 作為登入帳號',
        '重設密碼連結會寄至註冊 Email，請留意垃圾郵件匣',
        '首次登入建議立即修改密碼以保障帳號安全',
      ],
      accent: 'violet',
      icon: 'login',
      videoChapterId: 'login',
    },
    {
      code: '導覽',
      name: '主畫面導覽與通知設定',
      tagline: '熟悉介面 → 掌握訊息通知',
      whenToUse:
        '登入後了解各功能入口，並依個人需求調整 Email 通知設定。',
      scenarios: [
        '瀏覽主畫面選單與常用功能入口',
        '查看訊息中心中的待辦與系統通知',
        '至個人設定調整 Email 通知項目與頻率',
      ],
      highlights: [
        '主畫面集中呈現待簽核、待送件等常用捷徑',
        '訊息中心可追蹤單據狀態與系統提醒',
        'Email 通知可自訂，避免漏接重要簽核訊息',
      ],
      accent: 'slate',
      icon: 'navigation',
      videoChapterId: 'navigation',
    },
    {
      code: '代理',
      name: '代理人功能設定',
      tagline: '出差請假 → 指定代理人代辦',
      whenToUse:
        '預計無法自行送單或簽核時，事先設定送單代理人或簽核代理人。',
      scenarios: [
        '出差、休假前設定簽核代理人代為審核',
        '指定送單代理人協助代填或代送表單',
        '啟用代替送單模式，實際操作代送流程',
      ],
      highlights: [
        '簽核代理人：代您審核他人送出的單據',
        '送單代理人：代您填寫或送出費用表單',
        '代替送單模式可切換身分，確認代送對象後再操作',
      ],
      accent: 'amber',
      icon: 'proxy',
      videoChapterId: 'proxy',
    },
  ],
  tips: [
    '代理人設定建議在出差或休假前先完成，避免簽核流程中斷。',
    '簽核代理人與送單代理人功能不同，請依實際需求分別設定。',
    '若登入或重設密碼遇到問題，可聯繫公司 MIS 或至幫助中心查詢。',
  ],
  helpCenterUrl: 'https://go-commeet.zendesk.com/hc/zh-tw',
  nextSlug: 'commmeet-general-02',
};
