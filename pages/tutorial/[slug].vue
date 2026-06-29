<script setup lang="ts">
import { getLessonBySlug, getSeriesById } from '~/data/tutorials';

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const lesson = computed(() => getLessonBySlug(slug.value));

if (!lesson.value || lesson.value.status !== 'published') {
  throw createError({
    statusCode: 404,
    statusMessage: lesson.value ? '此教學尚未上架' : '找不到此教學',
  });
}

const currentLesson = lesson.value;
const series = getSeriesById(currentLesson.seriesId);
const docNumberChapter = currentLesson.videoChapters?.find(
  (c) => c.id === 'doc-number'
);

const { playerRef } = provideTutorialVideoSeek();

useHead({
  title: currentLesson.title,
});
</script>

<template>
  <article class="min-h-screen bg-white">
    <header class="border-b border-slate-100 bg-gradient-to-br from-orange-50/60 to-white">
      <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <nav class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500" aria-label="麵包屑">
          <NuxtLink to="/tutorial" class="hover:text-orange-600">
            操作教學
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink
            v-if="series"
            to="/tutorial"
            class="hover:text-orange-600"
          >
            {{ series.title }}
          </NuxtLink>
          <span v-if="series" aria-hidden="true">/</span>
          <span class="text-slate-700">
            第 {{ currentLesson.episode }} 集 · {{ currentLesson.title }}
          </span>
        </nav>

        <p class="text-sm font-medium text-orange-600">
          {{ currentLesson.subtitle }}
        </p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ currentLesson.title }}
        </h1>
        <p class="mt-3 text-lg text-slate-600">
          {{ currentLesson.description }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          約 {{ currentLesson.estimatedMinutes }} 分鐘閱讀 · 適用對象：全公司各部門
        </p>
      </div>
    </header>

    <div class="mx-auto max-w-3xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
      <div ref="playerRef" class="scroll-mt-24">
        <TutorialVideoEmbed
          v-if="currentLesson.video"
          :video="currentLesson.video"
          :chapters="currentLesson.videoChapters"
        />
      </div>

      <TutorialKeyPointsTimeline
        v-if="currentLesson.keyPoints.length"
        :points="currentLesson.keyPoints"
      />

      <TutorialFormDetailCards
        v-if="currentLesson.forms?.length"
        :forms="currentLesson.forms"
        :chapters="currentLesson.videoChapters"
        :section-title="currentLesson.formsSectionTitle"
      />

      <TutorialDocNumberDecoder
        v-if="docNumberChapter"
        :video-chapter-id="docNumberChapter.id"
        :video-start-seconds="docNumberChapter.startSeconds"
      />

      <section
        v-if="currentLesson.tips?.length"
        class="rounded-2xl border border-slate-200 bg-slate-50 p-6"
      >
        <h2 class="text-lg font-bold text-slate-900">溫馨提醒</h2>
        <ul class="mt-4 space-y-3">
          <li
            v-for="(tip, index) in currentLesson.tips"
            :key="index"
            class="flex items-start gap-3 text-slate-700"
          >
            <span class="mt-0.5 shrink-0 text-orange-500">💡</span>
            <span>{{ tip }}</span>
          </li>
        </ul>
        <a
          v-if="currentLesson.helpCenterUrl"
          :href="currentLesson.helpCenterUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
        >
          前往 COMMEET 幫助中心 →
        </a>
      </section>

      <TutorialLessonNav :lesson="currentLesson" />
    </div>
  </article>
</template>
