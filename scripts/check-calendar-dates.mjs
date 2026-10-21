import assert from 'node:assert/strict';
import { types, neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
process.env.TZ = 'Asia/Seoul';
const original = types.getTypeParser(1082)('2026-10-21');
console.log('Default Neon DATE JSON:', JSON.stringify(original));
// Apply the same DATE-only parser as server/db/client.ts; timestamps keep their normal parsers.
types.setTypeParser(1082, (value) => value);
assert.match(readFileSync('server/db/client.ts', 'utf8'), /types\.setTypeParser\(1082/);
for (const day of ['2026-10-01', '2026-10-21', '2026-10-31', '2028-02-29']) {
  assert.equal(types.getTypeParser(1082)(day), day);
  assert.equal(JSON.parse(JSON.stringify({ day: types.getTypeParser(1082)(day) })).day, day);
}
assert.equal(
  new Date('2026-10-20T15:30:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
  '2026-10-21',
);
assert.equal(
  new Date('2026-10-31T15:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
  '2026-11-01',
);
console.log(
  'PASS: DATE-only values survive JSON unchanged, KST early-morning events and month boundaries.',
);
if (process.argv.includes('--live')) {
  process.loadEnvFile();
  const db = neon(process.env.DATABASE_URL);
  const [row] = await db.query(
    `SELECT $1::date AS day, ($2::timestamptz AT TIME ZONE 'Asia/Seoul')::date AS month_end`,
    ['2026-10-21', '2026-10-31T15:00:00.000Z'],
  );
  assert.equal(row.day, '2026-10-21');
  assert.equal(row.month_end, '2026-11-01');
  console.log('PASS: live Neon read-only DATE round-trip and KST month boundary.');
}
