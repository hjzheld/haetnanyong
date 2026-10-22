import { checkDatabaseConnection } from '#server/db/client';

export default defineEventHandler(async () => {
  try {
    return { ok: await checkDatabaseConnection(), database: 'neon-postgresql' };
  } catch (error) {
    console.error('[db-health] Database connection failed');
    throw createError({ statusCode: 503, statusMessage: 'Database connection failed' });
  }
});
