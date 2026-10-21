export default defineEventHandler((event) => ({
  ok: true,
  service: 'personal-schedule-reminder',
  timezone: 'Asia/Seoul',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  requestId: event.context.requestId,
  checkedAt: new Date().toISOString(),
}));
