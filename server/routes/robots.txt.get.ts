export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  const origin = getRequestURL(event).origin;
  return [
    'User-agent: *',
    'Allow: /$',
    'Disallow: /api/',
    'Disallow: /login',
    'Disallow: /projects',
    'Disallow: /items',
    'Disallow: /calendar',
    'Disallow: /reminders',
    'Disallow: /mypage',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
});
