import { neon, types, type NeonQueryFunction } from '@neondatabase/serverless';

// PostgreSQL DATE has no timezone. Turning it into a JS Date at local midnight
// makes JSON serialization shift it to the previous UTC day on a KST server.
types.setTypeParser(1082, (value: string) => value);

let client: NeonQueryFunction<false, false> | undefined;

export function sql() {
  if (!client) {
    const config = useRuntimeConfig();
    if (!config.databaseUrl) {
      throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' });
    }
    client = neon(config.databaseUrl);
  }
  return client;
}

export async function checkDatabaseConnection() {
  const rows = (await sql().query('SELECT 1 AS ok')) as Array<{ ok: number }>;
  return rows[0]?.ok === 1;
}
