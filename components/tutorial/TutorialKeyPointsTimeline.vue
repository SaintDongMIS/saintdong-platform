<script setup lang="ts">
import type { TutorialKeyPoint } from '~/types/tutorial';
import { formatVideoTime } from '~/utils/formatVideoTime';

defineProps<{
  points: TutorialKeyPoint[];
}>();

const { activeChapterId, seek } = useTutorialVideoSeek();

const iconPaths: Record<TutorialKeyPoint['icon'], string> = {
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

const { target, revealed } = useScrollReveal();

function jumpToVideo(point: TutorialKeyPoint) {
  if (point.videoStartSeconds == null) return;
  seek(point.videoStartSeconds, point.videoChapterId);
}
</script>

<template>
  <section ref="target" class="tutorial-keypoints">
    <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">本集教學重點</h2>
        <div class="mt-2 flex items-center gap-2">
          <span class="h-1 w-12 rounded-full bg-orange-500" />
          <span class="h-2 w-2 rounded-full bg-orange-500" />
        </div>
      </div>
      <p class="text-sm text-slate-500">
        點選項目可跳至影片中對應段落
      </p>
    </div>

    <ol class="relative mt-6 space-y-0">
      <div
        class="absolute left-[1.65rem] top-6 bottom-6 w-px bg-gradient-to-b from-orange-300 via-orange-400 to-orange-300"
        aria-hidden="true"
      />

      <li
        v-for="(point, index) in points"
        :key="point.order"
        class="relative"
        :class="revealed ? 'animate-fade-slide-in' : 'opacity-0'"
        :style="{ animationDelay: `${index * 180}ms` }"
      >
        <button
          type="button"
          class="group flex w-full items-center gap-4 rounded-xl py-5 text-left transition-all sm:gap-6 sm:py-6 sm:px-3"
          :class="
            activeChapterId === point.videoChapterId
              ? 'bg-orange-50 ring-2 ring-orange-300'
              : 'hover:bg-slate-50'
          "
          :disabled="point.videoStartSeconds == null"
          @click="jumpToVideo(point)"
        >
          <div
            class="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-100 transition-transform group-hover:scale-105"
            :class="
              activeChapterId === point.videoChapterId
                ? 'ring-2 ring-orange-400'
                : ''
            "
          >
            <svg
              class="h-6 w-6 text-slate-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.75"
                :d="iconPaths[point.icon]"
              />
            </svg>
            <span
              class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              :class="
                activeChapterId === point.videoChapterId
                  ? 'bg-orange-600'
                  : 'bg-orange-500'
              "
            />
          </div>

          <span
            class="text-4xl font-light tabular-nums text-slate-300 sm:text-5xl"
          >
            {{ point.order }}
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">
                {{ point.title }}
              </h3>
              <span
                v-if="point.code"
                class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600"
              >
                {{ point.code }}
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-600 sm:text-base">
              {{ point.summary }}
            </p>
          </div>

          <div
            v-if="point.videoStartSeconds != null"
            class="hidden shrink-0 flex-col items-end gap-1 sm:flex"
          >
            <span
              class="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              :class="
                activeChapterId === point.videoChapterId
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-700 group-hover:bg-orange-100 group-hover:text-orange-800'
              "
            >
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {{ formatVideoTime(point.videoStartSeconds) }}
            </span>
            <span class="text-xs text-slate-400">跳至影片</span>
          </div>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-fade-slide-in {
  animation: fade-slide-in 0.55s ease-out forwards;
}
</style>
