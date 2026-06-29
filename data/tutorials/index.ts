import type { TutorialLesson, TutorialSeries } from '~/types/tutorial';
import { commmeetGeneral01 } from './commmeet-general-01';
import { commmeetGeneral02 } from './commmeet-general-02';
import { commmeetGeneral03 } from './commmeet-general-03';
import { commmeetGeneral05 } from './commmeet-general-05';
import { commmeetGeneral06 } from './commmeet-general-06';

const comingSoon = (partial: Omit<TutorialLesson, 'status' | 'keyPoints'> & { keyPoints?: TutorialLesson['keyPoints'] }): TutorialLesson => ({
  keyPoints: [],
  status: 'coming-soon',
  ...partial,
});

export const tutorialLessons: TutorialLesson[] = [
  commmeetGeneral01,
  commmeetGeneral02,
  commmeetGeneral03,
  commmeetGeneral05,
  commmeetGeneral06,
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
