import type { User } from '~/types/workspace';

export function useApi() {
  const baseRequest = useRequestFetch();
  const route = useRoute();
  const user = useState<User | null>('session-user', () => null);
  const redirecting = useState('session-redirecting', () => false);
  const checkedAt = useState('session-checked-at', () => 0);
  const generation = useState('session-generation', () => 0);

  const request = async <T>(url: string, options?: Parameters<typeof $fetch<T>>[1]) => {
    const startedGeneration = generation.value;
    try {
      return await baseRequest<T>(url, options);
    } catch (error) {
      const e = error as { status?: number; statusCode?: number; data?: { statusCode?: number } };
      const status = e.statusCode || e.status || e.data?.statusCode;
      if (
        status === 401 &&
        import.meta.client &&
        generation.value === startedGeneration &&
        route.path !== '/login' &&
        !redirecting.value
      ) {
        redirecting.value = true;
        generation.value++;
        user.value = null;
        checkedAt.value = Date.now();
        clearNuxtData();
        try {
          await navigateTo(
            { path: '/login', query: { redirect: route.fullPath } },
            { replace: true },
          );
        } finally {
          redirecting.value = false;
        }
      }
      throw error;
    }
  };

  return { request };
}
