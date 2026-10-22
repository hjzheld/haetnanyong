import type { RouterConfig } from '@nuxt/schema';
import { useNuxtApp } from '#app/nuxt';
import { useRouter } from '#app/composables/router';
import { START_LOCATION } from 'vue-router';

export default {
  scrollBehavior(to, from) {
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth';
    const position = () => (to.hash ? { el: to.hash, behavior } : { left: 0, top: 0, behavior });

    // Switching a tab/filter should not move the surrounding page.
    if (to.path === from.path) {
      if (to.hash || from.hash) return position();
      return false;
    }
    if (from === START_LOCATION) return position();

    const nuxtApp = useNuxtApp();
    const router = useRouter();
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        requestAnimationFrame(() => {
          resolve(router.currentRoute.value.fullPath === to.fullPath ? position() : false);
        });
      });
    });
  },
} satisfies RouterConfig;
