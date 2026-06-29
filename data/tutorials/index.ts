import type { TutorialLesson, TutorialSeries } from '~/types/tutorial';
import { commmeetGeneral01 } from './commmeet-general-01';
import { commmeetGeneral02 } from './commmeet-general-02';

const comingSoon = (partial: Omit<TutorialLesson, 'status' | 'keyPoints'> & { keyPoints?: TutorialLesson['keyPoints'] }): TutorialLesson => ({
  keyPoints: [],
  status: 'coming-soon',
  ...partial,
});

export const tutorialLessons: TutorialLesson[] = [
  commmeetGeneral01,
  commmeetGeneral02,
  comingSoon({
    slug: 'commmeet-general-03',
    seriesId: 'commmeet-general',
    episode: 3,
    title: '費用申請單與費用報銷單',
    subtitle: 'COMMEET 系統操作教學 通用篇（三）',
    description: '深入操作費用申請單與費用報銷單的填寫與勾稽流程。',
    audience: ['all'],
    estimatedMinutes: 8,
    prevSlug: 'commmeet-general-02',
    nextSlug: 'commmeet-general-05',
  }),
  comingSoon({
    slug: 'commmeet-general-05',
    seriesId: 'commmeet-general',
    episode: 5,
    title: '手機與電腦申請費用報銷單',
    subtitle: 'COMMEET 系統操作教學 通用篇（五）',
    description: '跨裝置申請費用報銷單的操作示範。',
    audience: ['all'],
    estimatedMinutes: 5,
    prevSlug: 'commmeet-general-03',
    nextSlug: 'commmeet-general-06',
  }),
  comingSoon({
    slug: 'commmeet-general-06',
    seriesId: 'commmeet-general',
    episode: 6,
    title: '手機與電腦簽核單據',
    subtitle: 'COMMEET 系統操作教學 通用篇（六）',
    description: '在手機與電腦上簽核單據的操作方式。',
    audience: ['all'],
    estimatedMinutes: 6,
    prevSlug: 'commmeet-general-05',
  }),
  comingSoon({
    slug: 'commmeet-finance-02',
    seriesId: 'commmeet-finance',
    episode: 2,
    title: '付款報表',
    subtitle: 'COMMEET 系統操作教學 財會篇（二）',
    description: '財會人員使用付款報表的教學。',
    audience: ['finance'],
    estimatedMinutes: 3,
  }),
];

export const tutorialSeries: TutorialSeries[] = [
  {
    id: 'commmeet-general',
    title: 'COMMEET 通用篇',
    description: '全公司同仁必學的 COMMEET 基礎操作，涵蓋登入、表單種類與跨裝置申請簽核。',
    source: 'COMMEET 智能費用管理系統',
    lessons: [
      'commmeet-general-01',
      'commmeet-general-02',
      'commmeet-general-03',
      'commmeet-general-05',
      'commmeet-general-06',
    ],
  },
  {
    id: 'commmeet-finance',
    title: 'COMMEET 財會篇',
    description: '財務與會計人員專用的 COMMEET 進階功能教學。',
    source: 'COMMEET 智能費用管理系統',
    lessons: ['commmeet-finance-02'],
  },
];

export function getLessonBySlug(slug: string): TutorialLesson | undefined {
  return tutorialLessons.find((l) => l.slug === slug);
}

export function getPublishedLessons(): TutorialLesson[] {
  return tutorialLessons.filter((l) => l.status === 'published');
}

export function getSeriesLessons(seriesId: string): TutorialLesson[] {
  const series = tutorialSeries.find((s) => s.id === seriesId);
  if (!series) return [];
  return series.lessons
    .map((slug) => getLessonBySlug(slug))
    .filter((l): l is TutorialLesson => !!l);
}

export function getSeriesById(seriesId: string): TutorialSeries | undefined {
  return tutorialSeries.find((s) => s.id === seriesId);
}
