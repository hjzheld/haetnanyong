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
    // Fetch/DB error objects may contain credentials, SQL parameters or message text.
    const code = (error as { code?: unknown }).code;
    if (status >= 500)
      console.error(`[request:${requestId}]`, {
        status,
        code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/i.test(code) ? code : 'server_error',
      });
  });
});
