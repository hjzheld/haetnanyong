import assert from 'node:assert/strict';
import { loadTsModule } from './load-ts-module.mjs';
const { eventHasEnded, displayReminder } = await loadTsModule('app/utils/plan-time.ts');
const now = Date.parse('2026-10-22T00:00:00+09:00');
assert.equal(eventHasEnded({ endsAt: '2026-10-22T00:00:00+09:00' }, now), true);
assert.equal(eventHasEnded({ endsAt: '2026-10-22T00:00:01+09:00' }, now), false);
assert.equal(eventHasEnded({ allDay: true, endDate: '2026-10-22' }, now), true);
assert.equal(eventHasEnded({ allDay: true, endDate: '2026-10-23' }, now), false);
assert.equal(eventHasEnded({ endsAt: 'invalid' }, now), false);
assert.equal(eventHasEnded({}, now), false);
const reminder = { status: 'SCHEDULED', remindAt: new Date(now).toISOString() };
assert.equal(displayReminder(reminder, now).status, 'ELAPSED');
assert.equal(reminder.status, 'SCHEDULED', 'Display must not mutate server data');
assert.equal(displayReminder(reminder, now - 1).status, 'SCHEDULED');
for (const status of ['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING', 'FAILED', 'CANCELED'])
  assert.equal(displayReminder({ ...reminder, status }, now).status, status);
console.log(
  'PASS timed/all-day end boundaries, display expiry, pending states and source preservation',
);
