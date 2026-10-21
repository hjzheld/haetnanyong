import * as Sentry from '@sentry/nuxt';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
