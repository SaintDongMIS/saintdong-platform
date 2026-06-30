<script setup lang="ts">
import {
  getPublishedLessons,
  getSeriesLessons,
  tutorialSeries,
} from '~/data/tutorials';

useHead({
  title: '操作教學中心',
});

const publishedCount = getPublishedLessons().length;
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-slate-50">
    <!-- Hero -->
    <header class="border-b border-orange-100 bg-white/80 backdrop-blur">
      <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <p class="text-sm font-medium text-orange-600">全公司教學中心</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          操作教學
        </h1>
        <p class="mt-3 max-w-2xl text-lg text-slate-600">
          圖文步驟搭配影片，幫助各部門同仁快速上手企業系統操作。
          目前已上架 {{ publishedCount }} 篇完整教學。
        </p>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <section
        v-for="series in tutorialSeries"
        :key="series.id"
        class="mb-12"
      >
        <div class="mb-6">
          <h2 class="text-xl font-bold text-slate-900 sm:text-2xl">
            {{ series.title }}
          </h2>
          <p class="mt-1 text-slate-600">{{ series.description }}</p>
          <p class="mt-1 text-sm text-slate-400">來源：{{ series.source }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <NuxtLink
            v-for="lesson in getSeriesLessons(series.id)"
            :key="lesson.slug"
            :to="
              lesson.status === 'published'
                ? `/tutorial/${lesson.slug}`
                : undefined
            "
            class="group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all"
            :class="
              lesson.status === 'published'
                ? 'border-slate-200 hover:border-orange-300 hover:shadow-md cursor-pointer'
                : 'border-slate-100 opacity-70 cursor-default'
            "
          >
            <div class="flex items-start justify-between gap-3">
              <span
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-sm font-bold text-orange-700"
              >
                {{ lesson.episode }}
              </span>
              <span
                v-if="lesson.status === 'coming-soon'"
                class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
              >
                即將推出
              </span>
              <span
                v-else
                class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              >
                可閱讀
              </span>
            </div>

            <h3
              class="mt-3 font-semibold text-slate-900 transition-colors group-hover:text-orange-700"
            >
              {{ lesson.title }}
            </h3>
            <p class="mt-1 text-sm text-slate-500">{{ lesson.subtitle }}</p>
            <p class="mt-3 line-clamp-2 text-sm text-slate-600">
              {{ lesson.description }}
            </p>

            <div class="mt-4 flex items-center gap-3 text-xs text-slate-400">
              <span>約 {{ lesson.estimatedMinutes }} 分鐘</span>
              <span v-if="lesson.video">含影片</span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <div class="max-w-md pb-4">
        <TutorialAppStoreBadges />
      </div>
    </main>
  </div>
</template>
