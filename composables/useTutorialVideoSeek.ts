type TutorialVideoSeekContext = {
  activeChapterId: Ref<string | null>;
  seekNonce: Ref<number>;
  seekToSeconds: Ref<number>;
  shouldAutoplay: Ref<boolean>;
  seek: (seconds: number, chapterId?: string) => void;
  scrollToPlayer: () => void;
};

const tutorialVideoSeekKey: InjectionKey<TutorialVideoSeekContext> =
  Symbol('tutorial-video-seek');

export function provideTutorialVideoSeek() {
  const activeChapterId = ref<string | null>(null);
  const seekToSeconds = ref(0);
  const seekNonce = ref(0);
  const shouldAutoplay = ref(false);
  const playerRef = ref<HTMLElement | null>(null);

  function seek(seconds: number, chapterId?: string) {
    seekToSeconds.value = seconds;
    activeChapterId.value = chapterId ?? null;
    shouldAutoplay.value = true;
    seekNonce.value += 1;
    scrollToPlayer();
  }

  function scrollToPlayer() {
    nextTick(() => {
      playerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const context: TutorialVideoSeekContext = {
    activeChapterId,
    seekNonce,
    seekToSeconds,
    shouldAutoplay,
    seek,
    scrollToPlayer,
  };

  provide(tutorialVideoSeekKey, context);

  return { ...context, playerRef };
}

export function useTutorialVideoSeek() {
  const context = inject(tutorialVideoSeekKey);
  if (!context) {
    throw new Error('useTutorialVideoSeek must be used within a lesson page');
  }
  return context;
}
