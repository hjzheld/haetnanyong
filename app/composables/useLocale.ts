import { translate, type Locale } from '~/utils/locale';
import { showTime } from '~/utils/display';

export function useLocale() {
  const cookie = useCookie<string>('nyang-locale', {
    default: () => 'ko',
    maxAge: 31536000,
    sameSite: 'lax',
    path: '/',
  });
  const locale = useState<Locale>('app-locale', () => (cookie.value === 'en' ? 'en' : 'ko'));
  function selectLocale(value: Locale) {
    locale.value = value;
    cookie.value = value;
  }
  const tr = (message: unknown) => translate(locale.value, message);
  const formatTime = (value?: string | null) => showTime(value, locale.value);
  const formatMonth = (month: string) =>
    new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'long',
      timeZone: 'Asia/Seoul',
    }).format(new Date(month + '-01T12:00:00+09:00'));
  return { locale: readonly(locale), selectLocale, tr, formatTime, formatMonth };
}
