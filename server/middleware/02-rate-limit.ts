import { createHash } from 'node:crypto';
import { query } from '#server/utils/db';
const limits: Record<string, { max: number; windowMs: number }> = {
  '/api/account/slack/test': { max: 3, windowMs: 60_000 },
  '/api/auth/login': { max: 10, windowMs: 10 * 60_000 },
  '/api/auth/register': { max: 20, windowMs: 60 * 60_000 },
  '/api/account/slack/challenge': { max: 10, windowMs: 60 * 60_000 },
  '/api/account/slack/start': { max: 10, windowMs: 60 * 60_000 },
};

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') return;
  const path = getRequestURL(event).pathname;
  const limit = limits[path];
  if (!limit) return;

  const now = Date.now();
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const secret = useRuntimeConfig().sessionSecret || 'local-rate-limit';
  const identifier = createHash('sha256').update(`${secret}:${ip}`).digest('hex');
  const windowStartedAt = new Date(Math.floor(now / limit.windowMs) * limit.windowMs);
  const resetAt = windowStartedAt.getTime() + limit.windowMs;
  const [bucket] = await query<{ count: number }>(
    `INSERT INTO api_rate_limits
       (endpoint, identifier_hash, window_started_at, request_count, expires_at)
     VALUES ($1,$2,$3,1,$4)
     ON CONFLICT (endpoint, identifier_hash, window_started_at)
     DO UPDATE SET request_count=api_rate_limits.request_count+1
     RETURNING request_count AS count`,
    [path, identifier, windowStartedAt.toISOString(), new Date(resetAt).toISOString()],
  );
  const count = Number(bucket?.count || 1);

  const remaining = Math.max(0, limit.max - count);
  setHeader(event, 'X-RateLimit-Limit', String(limit.max));
  setHeader(event, 'X-RateLimit-Remaining', String(remaining));
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (count > limit.max) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    setHeader(event, 'Retry-After', String(retryAfter));
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' });
  }
});
