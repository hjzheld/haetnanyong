import type { User } from '~/types/workspace';
export function useSession() {
  const user = useState<User | null>('session-user', () => null);
  const request = useRequestFetch();
  const checkedAt = useState('session-checked-at', () => 0);
  const generation = useState('session-generation', () => 0);
  const nuxtApp = useNuxtApp();
  const sessionRequests = nuxtApp as typeof nuxtApp & { _sessionRestore?: Promise<void> };
  async function restore() {
    // Revalidate periodically; protected APIs still authenticate every request.
    if (Date.now() - checkedAt.value < 60_000) return;
    // An anonymous SSR request has no session to restore.
    if (import.meta.server && !useCookie('session').value) {
      user.value = null;
      checkedAt.value = Date.now();
      return;
    }
    if (sessionRequests._sessionRestore) return sessionRequests._sessionRestore;
    const startedGeneration = generation.value;
    sessionRequests._sessionRestore = (async () => {
      try {
        const result = await request<{ user: User }>('/api/auth/me');
        if (generation.value !== startedGeneration) return;
        user.value = result.user;
        checkedAt.value = Date.now();
      } catch (e: unknown) {
        if (generation.value !== startedGeneration) return;
        const status = e as { statusCode?: number; status?: number };
        if ((status.statusCode || status.status) !== 401) throw e;
        user.value = null;
        checkedAt.value = Date.now();
      }
    })();
    try {
      await sessionRequests._sessionRestore;
    } finally {
      sessionRequests._sessionRestore = undefined;
    }
  }
  function setUser(value: User | null) {
    generation.value++;
    user.value = value;
    checkedAt.value = Date.now();
  }
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    clearNuxtData();
    await navigateTo('/login');
  }
  return { user, restore, logout, setUser };
}
