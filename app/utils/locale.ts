import en from '~/locales/en';

export type Locale = 'ko' | 'en';
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const templates = Object.entries(en)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
    const names: string[] = [];
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d+)\\\}/g, (_, n) => {
      names.push(n);
      return '(.*?)';
    });
    return { pattern: new RegExp('^' + escaped + '$'), names, value };
  });
export function translate(locale: Locale, message: unknown): string {
  if (message == null) return '';
  const source = String(message);
  if (locale === 'ko') return source;
  const key = normalize(source);
  if (Object.hasOwn(en, key))
    return (source.startsWith(' ') ? ' ' : '') + en[key]! + (source.endsWith(' ') ? ' ' : '');
  for (const template of templates) {
    const match = template.pattern.exec(key);
    if (match)
      return template.value.replace(/\{(\d+)\}/g, (_, n) =>
        translate(locale, match[template.names.indexOf(n) + 1]),
      );
  }
  return source;
}
