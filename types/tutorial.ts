export type TutorialAudience = 'all' | 'finance' | 'hr' | 'mis' | 'road-construction';

export type TutorialStatus = 'published' | 'coming-soon';

export interface TutorialVideo {
  youtubeId: string;
  title: string;
  channel: string;
  duration: string;
  url: string;
}

export interface TutorialVideoChapter {
  id: string;
  title: string;
  startSeconds: number;
  code?: string;
}

export type TutorialTopicIcon =
  | 'reimbursement'
  | 'application'
  | 'prepayment'
  | 'login'
  | 'navigation'
  | 'proxy';

export interface TutorialKeyPoint {
  order: number;
  code?: string;
  title: string;
  summary: string;
  icon: TutorialTopicIcon;
  /** 對應 YouTube 影片時間（秒） */
  videoStartSeconds?: number;
  videoChapterId?: string;
}

export interface TutorialFormGuide {
  code: string;
  name: string;
  tagline: string;
  whenToUse: string;
  scenarios: string[];
  highlights: string[];
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
  icon: TutorialTopicIcon;
  /** 對應 videoChapters.id，用於非表單代碼的教學段落 */
  videoChapterId?: string;
  /** 內建 UI 示意（免圖檔） */
  mockup?: 'commmeet-app-url';
  mockupCaption?: string;
  /** mockup 專用參數 */
  mockupProps?: {
    companyUrl?: string;
  };
}

export interface TutorialFlowStep {
  code: string;
  title: string;
  description: string;
  videoStartSeconds?: number;
  videoChapterId?: string;
}

export interface TutorialSection {
  id: string;
  title: string;
  content?: string;
}

export interface TutorialLesson {
  slug: string;
  seriesId: string;
  episode: number;
  title: string;
  subtitle: string;
  description: string;
  audience: TutorialAudience[];
  status: TutorialStatus;
  estimatedMinutes: number;
  video?: TutorialVideo;
  videoChapters?: TutorialVideoChapter[];
  keyPoints: TutorialKeyPoint[];
  forms?: TutorialFormGuide[];
  /** 詳解區塊標題，預設依各集內容而定 */
  formsSectionTitle?: string;
  flowSteps?: TutorialFlowStep[];
  tips?: string[];
  helpCenterUrl?: string;
  prevSlug?: string;
  nextSlug?: string;
}

export interface TutorialSeries {
  id: string;
  title: string;
  description: string;
  source: string;
  lessons: string[];
}
