<script setup lang="ts">
import { getLessonBySlug } from '~/data/tutorials';
import type { TutorialLesson } from '~/types/tutorial';

const props = defineProps<{
  lesson: TutorialLesson;
}>();

const prevLesson = computed(() =>
  props.lesson.prevSlug ? getLessonBySlug(props.lesson.prevSlug) : undefined
);
const nextLesson = computed(() =>
  props.lesson.nextSlug ? getLessonBySlug(props.lesson.nextSlug) : undefined
);
</script>

<template>
  <nav
    class="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-8 sm:flex-row sm:justify-between"
    aria-label="教學導覽"
  >
    <NuxtLink
      v-if="prevLesson"
      :to="`/tutorial/${prevLesson.slug}`"
      class="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50/50 sm:max-w-xs"
      :class="{ 'pointer-events-none opacity-50': prevLesson.status === 'coming-soon' }"
    >
      <svg
        class="h-5 w-5 text-slate-400 transition-transform group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      <div>
        <p class="text-xs text-slate-500">上一集</p>
        <p class="font-medium text-slate-900">{{ prevLesson.title }}</p>
      </div>
    </NuxtLink>
    <div v-else class="hidden sm:block sm:flex-1" />

    <NuxtLink
      v-if="nextLesson"
      :to="nextLesson.status === 'published' ? `/tutorial/${nextLesson.slug}` : '#'"
      class="group flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right transition-colors hover:border-orange-300 hover:bg-orange-50/50 sm:max-w-xs"
      :class="{ 'pointer-events-none opacity-50': nextLesson.status === 'coming-soon' }"
    >
      <div>
        <p class="text-xs text-slate-500">下一集</p>
        <p class="font-medium text-slate-900">
          {{ nextLesson.title }}
          <span
            v-if="nextLesson.status === 'coming-soon'"
            class="ml-1 text-xs text-slate-400"
          >(即將推出)</span>
        </p>
      </div>
      <svg
        class="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </NuxtLink>
  </nav>
</template>
