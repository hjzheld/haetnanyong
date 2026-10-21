import { randomUUID } from 'node:crypto';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default defineEventHandler((event) => {
  const requestId = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  event.context.requestId = requestId;
  setHeader(event, 'X-Request-Id', requestId);
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setHeader(
    event,
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://*.ingest.sentry.io;",
  );

  if (!import.meta.dev) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const path = getRequestURL(event).pathname;
  if (path.startsWith('/api/')) setHeader(event, 'Cache-Control', 'no-store');

  if (!path.startsWith('/api/') || !unsafeMethods.has(event.method)) return;

  const fetchSite = getHeader(event, 'sec-fetch-site');
  if (fetchSite === 'cross-site') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request is not allowed' });
  }

  const origin = getHeader(event, 'origin');
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: 'Request origin does not match' });
  }
});
