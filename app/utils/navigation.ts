export function safeInternalRedirect(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return fallback;

  try {
    const base = 'http://localhost';
    const target = new URL(value, base);
    if (target.origin !== base || target.pathname === '/login') return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
