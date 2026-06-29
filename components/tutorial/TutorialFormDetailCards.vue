<script setup lang="ts">
import type { TutorialFormGuide, TutorialTopicIcon, TutorialVideoChapter } from '~/types/tutorial';
import { formatVideoTime } from '~/utils/formatVideoTime';

const props = withDefaults(
  defineProps<{
    forms: TutorialFormGuide[];
    chapters?: TutorialVideoChapter[];
    sectionTitle?: string;
  }>(),
  {
    sectionTitle: '三種表單詳解',
  },
);

const { seek } = useTutorialVideoSeek();

const iconPaths: Record<TutorialTopicIcon, string> = {
  reimbursement:
    'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  application:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  prepayment:
    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  login:
    'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
  navigation:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  proxy:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
};

const formIcons: TutorialTopicIcon[] = ['login', 'navigation', 'proxy'];

function chapterForForm(form: TutorialFormGuide) {
  if (form.videoChapterId) {
    return props.chapters?.find((c) => c.id === form.videoChapterId);
  }
  return props.chapters?.find((c) => c.code === form.code);
}

function watchInVideo(form: TutorialFormGuide, event: Event) {
  event.stopPropagation();
  const chapter = chapterForForm(form);
  if (chapter) seek(chapter.startSeconds, chapter.id);
}

const accentMap = {
  blue: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    ring: 'ring-blue-100',
    dot: 'bg-blue-500',
    icon: 'text-blue-700',
  },
  emerald: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    ring: 'ring-emerald-100',
    dot: 'bg-emerald-500',
    icon: 'text-emerald-700',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    ring: 'ring-amber-100',
    dot: 'bg-amber-500',
    icon: 'text-amber-700',
  },
  violet: {
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    ring: 'ring-violet-100',
    dot: 'bg-violet-500',
    icon: 'text-violet-700',
  },
  slate: {
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    badge: 'bg-slate-100 text-slate-700',
    ring: 'ring-slate-100',
    dot: 'bg-slate-500',
    icon: 'text-slate-700',
  },
};

const expandedIndex = ref<number | null>(0);

function toggle(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index;
}
</script>

<template>
  <section>
    <h2 class="mb-6 text-2xl font-bold text-slate-900">{{ sectionTitle }}</h2>

    <div class="space-y-4">
      <article
        v-for="(form, index) in forms"
        :key="form.code"
        class="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
        :class="accentMap[form.accent].border"
      >
        <button
          type="button"
          class="flex w-full items-start gap-4 p-5 text-left sm:p-6"
          @click="toggle(index)"
        >
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-4"
            :class="[accentMap[form.accent].bg, accentMap[form.accent].ring]"
          >
            <svg
              v-if="formIcons.includes(form.icon)"
              class="h-6 w-6"
              :class="accentMap[form.accent].icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.75"
                :d="iconPaths[form.icon]"
              />
            </svg>
            <span
              v-else
              class="font-mono text-sm font-bold"
              :class="accentMap[form.accent].badge.split(' ')[1]"
            >
              {{ form.code }}
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ form.name }}
              </h3>
              <div class="flex items-center gap-2">
                <button
                  v-if="chapterForForm(form)"
                  type="button"
                  class="hidden shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800 hover:bg-orange-200 sm:inline-flex"
                  @click="watchInVideo(form, $event)"
                >
                  ▶ {{ formatVideoTime(chapterForForm(form)!.startSeconds) }}
                </button>
                <svg
                  class="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300"
                  :class="{ 'rotate-180': expandedIndex === index }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
            <p class="mt-1 text-sm font-medium text-slate-600">
              {{ form.tagline }}
            </p>
          </div>
        </button>

        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-[600px]"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 max-h-[600px]"
          leave-to-class="opacity-0 max-h-0"
        >
          <div
            v-show="expandedIndex === index"
            class="overflow-hidden border-t px-5 pb-5 sm:px-6 sm:pb-6"
            :class="accentMap[form.accent].border"
          >
            <p class="mt-4 text-slate-700">{{ form.whenToUse }}</p>

            <button
              v-if="chapterForForm(form)"
              type="button"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 sm:hidden"
              @click="watchInVideo(form, $event)"
            >
              ▶ 跳至影片 {{ formatVideoTime(chapterForForm(form)!.startSeconds) }}
            </button>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h4 class="mb-2 text-sm font-semibold text-slate-900">
                  常見情境
                </h4>
                <ul class="space-y-2">
                  <li
                    v-for="scenario in form.scenarios"
                    :key="scenario"
                    class="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span
                      class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="accentMap[form.accent].dot"
                    />
                    {{ scenario }}
                  </li>
                </ul>
              </div>
              <div>
                <h4 class="mb-2 text-sm font-semibold text-slate-900">
                  重點提醒
                </h4>
                <ul class="space-y-2">
                  <li
                    v-for="highlight in form.highlights"
                    :key="highlight"
                    class="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span
                      class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="accentMap[form.accent].dot"
                    />
                    {{ highlight }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Transition>
      </article>
    </div>
  </section>
</template>
