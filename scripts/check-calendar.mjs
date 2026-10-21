import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['app/utils/calendar.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { occursOnDay, toCalendarItems, groupCalendarItems } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

const items = toCalendarItems(
  [{ id: 'task', projectId: null, startDate: '2026-10-01', dueDate: '2026-10-21' }],
  [
    { id: 'all-day', projectId: '1', allDay: true, startDate: '2026-10-31', endDate: '2026-11-02' },
    {
      id: 'timed',
      projectId: null,
      allDay: false,
      startsAt: '2026-10-21T14:00:00.000Z',
      endsAt: '2026-10-22T15:00:00.000Z',
    },
  ],
);
assert.equal(items.length, 3, 'Both project and standalone items must be retained');
assert.equal(occursOnDay(items[0], '2026-10-21'), true);
assert.equal(occursOnDay(items[0], '2026-10-01'), false, 'Tasks appear on their due date');
assert.equal(occursOnDay(items[1], '2026-10-31'), true);
assert.equal(occursOnDay(items[1], '2026-11-01'), true, 'All-day events cross month boundaries');
assert.equal(occursOnDay(items[1], '2026-11-02'), false, 'All-day end dates are exclusive');
assert.equal(occursOnDay(items[2], '2026-10-21'), true);
assert.equal(occursOnDay(items[2], '2026-10-22'), true);
assert.equal(occursOnDay(items[2], '2026-10-23'), false, 'Midnight KST ends exclude the next day');
assert.equal(occursOnDay({ ...items[2], startsAt: null }, '2026-10-21'), false);
const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-31', '2026-11-01', '2026-11-02'];
const grouped = groupCalendarItems(items, ['', ...days]);
assert.equal(grouped.has(''), false);
for (const day of days) {
  assert.deepEqual(
    grouped.get(day),
    items.filter((item) => occursOnDay(item, day)),
    `Grouped entries on ${day}`,
  );
}
console.log(
  'PASS: calendar task/all-day/timed dates, midnight, month boundaries and indexed entries.',
);

if (process.argv.includes('--benchmark')) {
  const monthDays = Array.from(
    { length: 31 },
    (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`,
  );
  const manyItems = Array.from({ length: 1000 }, (_, index) => ({
    ...items[2],
    id: String(index),
  }));
  const before = performance.now();
  const scanned = monthDays.map((day) => manyItems.filter((item) => occursOnDay(item, day)));
  const scannedMs = performance.now() - before;
  const indexedStart = performance.now();
  const indexed = groupCalendarItems(manyItems, monthDays);
  const indexedMs = performance.now() - indexedStart;
  assert.deepEqual(
    monthDays.map((day) => indexed.get(day).length),
    scanned.map((entries) => entries.length),
  );
  console.log(
    JSON.stringify({
      items: manyItems.length,
      days: monthDays.length,
      scanMs: Number(scannedMs.toFixed(2)),
      indexedMs: Number(indexedMs.toFixed(2)),
    }),
  );
}
