export default defineNuxtPlugin((nuxtApp) => {
  const animations = new WeakMap<HTMLElement, Animation>();
  const delays = new WeakMap<HTMLElement, number>();
  const observer: IntersectionObserver | undefined =
    import.meta.client && 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const el = entry.target as HTMLElement;
              observer?.unobserve(el);
              if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.animate)
                continue;
              const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 440,
                delay: delays.get(el) || 0,
                fill: 'backwards',
                easing: 'cubic-bezier(.22,1,.36,1)',
              });
              animations.set(el, animation);
            }
          },
          { threshold: 0.12 },
        )
      : undefined;
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps: () => ({}),
    mounted(el: HTMLElement, binding) {
      delays.set(el, Math.min(Math.max(Number(binding.value) || 0, 0), 5) * 65);
      observer?.observe(el);
    },
    beforeUnmount(el: HTMLElement) {
      observer?.unobserve(el);
      animations.get(el)?.cancel();
      animations.delete(el);
      delays.delete(el);
    },
  });
});
