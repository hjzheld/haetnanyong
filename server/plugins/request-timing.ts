export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.path.startsWith('/api/')) event.context.requestStartedAt = performance.now();
  });
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const startedAt = event.context.requestStartedAt as number | undefined;
    if (startedAt !== undefined) {
      appendResponseHeader(
        event,
        'Server-Timing',
        `server;dur=${(performance.now() - startedAt).toFixed(1)}`,
      );
    }
  });
});
