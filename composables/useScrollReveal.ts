export function useScrollReveal() {
  const revealed = ref(false);
  const target = ref<HTMLElement | null>(null);

  onMounted(() => {
    if (!target.value) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealed.value = true;
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(target.value);

    onUnmounted(() => observer.disconnect());
  });

  return { target, revealed };
}
