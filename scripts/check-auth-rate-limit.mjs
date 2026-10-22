import assert from 'node:assert/strict';
import { loadTsModule } from './load-ts-module.mjs';
const { rateLimitResetAt } = await loadTsModule('app/utils/rate-limit.ts');
const now = Date.parse('2026-10-22T01:12:00Z');
const error = (values) => ({ response: { headers: new Headers(values) } });
assert.equal(
  rateLimitResetAt(error({ 'X-RateLimit-Reset': '1792634400', 'Retry-After': '10' }), now),
  1792634400000,
);
assert.equal(rateLimitResetAt(error({ 'Retry-After': '48' }), now), now + 48000);
assert.equal(
  rateLimitResetAt(error({ 'Retry-After': 'Thu, 22 Oct 2026 02:00:00 GMT' }), now),
  Date.parse('2026-10-22T02:00:00Z'),
);
assert.equal(
  rateLimitResetAt(error({ 'X-RateLimit-Reset': 'invalid', 'Retry-After': '48' }), now),
  now + 48000,
);
assert.equal(rateLimitResetAt(error({ 'Retry-After': 'invalid' }), now), null);
assert.equal(rateLimitResetAt({}, now), null);
console.log(
  'PASS auth rate-limit reset parsing: server reset, retry seconds/date, malformed and missing headers',
);
