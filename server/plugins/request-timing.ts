export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.path.startsWith('/api/')) event.context.requestStartedAt = performance.now();
  });
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const startedAt = event.context.requestStartedAt as number | undefined;
    // Vercel may have already committed a redirect/streaming response by this
    // hook. Node rejects any header mutation after that point.
    if (startedAt !== undefined && !event.node.res.headersSent && !event.node.res.writableEnded) {
      appendResponseHeader(
        event,
        'Server-Timing',
        `server;dur=${(performance.now() - startedAt).toFixed(1)}`,
      );
    }
  });
});
