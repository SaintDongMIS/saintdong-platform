<script setup lang="ts">
import type { TutorialVideo, TutorialVideoChapter } from '~/types/tutorial';
import { formatVideoTime } from '~/utils/formatVideoTime';

const props = defineProps<{
  video: TutorialVideo;
  chapters?: TutorialVideoChapter[];
}>();

const { activeChapterId, seekNonce, seekToSeconds, shouldAutoplay, seek } =
  useTutorialVideoSeek();

const embedSrc = computed(() => {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
  });
  if (seekNonce.value > 0) {
    params.set('start', String(seekToSeconds.value));
    if (shouldAutoplay.value) {
      params.set('autoplay', '1');
    }
  }
  return `https://www.youtube.com/embed/${props.video.youtubeId}?${params.toString()}`;
});
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-lg">
    <div class="aspect-video w-full">
      <iframe
        :key="seekNonce"
        class="h-full w-full"
        :src="embedSrc"
        :title="video.title"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      />
    </div>

    <div
      v-if="chapters?.length"
      class="border-t border-slate-700 bg-slate-800/80 px-4 py-3 sm:px-5"
    >
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        影片章節 · 點選跳轉
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chapter in chapters"
          :key="chapter.id"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
          :class="
            activeChapterId === chapter.id
              ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          "
          @click="seek(chapter.startSeconds, chapter.id)"
        >
          <span
            v-if="chapter.code"
            class="font-mono text-xs opacity-90"
          >
            {{ chapter.code }}
          </span>
          <span>{{ chapter.title }}</span>
          <span class="text-xs opacity-75">
            {{ formatVideoTime(chapter.startSeconds) }}
          </span>
        </button>
      </div>
    </div>

    <div class="border-t border-slate-700 px-5 py-4 sm:px-6">
      <p class="text-sm text-slate-400">{{ video.channel }}</p>
      <h3 class="mt-1 font-medium text-white">{{ video.title }}</h3>
      <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>長度 {{ video.duration }}</span>
        <a
          :href="video.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-orange-400 hover:text-orange-300"
        >
          在 YouTube 開啟 →
        </a>
      </div>
    </div>
  </section>
</template>
