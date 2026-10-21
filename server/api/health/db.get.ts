import { checkDatabaseConnection } from '#server/db/client';

export default defineEventHandler(async () => {
  try {
    return { ok: await checkDatabaseConnection(), database: 'neon-postgresql' };
  } catch (error) {
    console.error('[db-health]', error instanceof Error ? error.message : error);
    throw createError({ statusCode: 503, statusMessage: 'Database connection failed' });
  }
});
