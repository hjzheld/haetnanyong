export type ThemePreference = 'light' | 'dark' | 'system';

export function useTheme() {
  const preference = useCookie<ThemePreference>('nyang-theme', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
  const resolved = useState<'light' | 'dark'>('resolved-theme', () => 'light');
  let media: MediaQueryList | undefined;
  function apply() {
    resolved.value =
      preference.value === 'dark' || (preference.value === 'system' && media?.matches)
        ? 'dark'
        : 'light';
    document.documentElement.dataset.theme = resolved.value;
  }
  function select(value: ThemePreference) {
    preference.value = value;
    apply();
  }
  onMounted(() => {
    if (!['light', 'dark', 'system'].includes(preference.value)) preference.value = 'system';
    media = window.matchMedia('(prefers-color-scheme: dark)');
    apply();
    media.addEventListener('change', apply);
  });
  onBeforeUnmount(() => media?.removeEventListener('change', apply));
  return { preference: readonly(preference), resolved: readonly(resolved), select };
}
