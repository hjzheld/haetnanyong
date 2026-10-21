export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();
  const missing = [
    !config.databaseUrl && 'DATABASE_URL',
    !config.sessionSecret && 'SESSION_SECRET',
  ].filter(Boolean);

  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (!import.meta.dev) throw new Error(message);
    console.warn(`[runtime-config] ${message}`);
  }

  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event) return;
    const requestId = String(event.context.requestId || 'UNKNOWN');
    const status = Number((error as { statusCode?: number }).statusCode || 500);
    if (status >= 500) console.error(`[request:${requestId}]`, error);
  });
});
