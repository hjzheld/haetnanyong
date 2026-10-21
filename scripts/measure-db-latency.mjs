import { performance } from 'node:perf_hooks';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);
for (let attempt = 1; attempt <= 5; attempt++) {
  const startedAt = performance.now();
  await sql.query('SELECT 1 AS ok');
  console.log(`Database round trip ${attempt}: ${Math.round(performance.now() - startedAt)}ms`);
}
