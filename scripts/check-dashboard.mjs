import assert from 'node:assert/strict';
import { loadTsModule } from './load-ts-module.mjs';
const { dashboardTasks } = await loadTsModule('app/utils/dashboard.ts');
const task = (id, dueDate, status = 'TODO', projectId = null) => ({
  id,
  dueDate,
  status,
  projectId,
});
const input = [
  task('old', '2026-12-30'),
  task('today', '2026-12-31'),
  task('boundary', '2027-01-03'),
  task('later', '2027-01-04'),
  task('done', '2026-12-29', 'DONE'),
  task('archived', '2026-12-28', 'TODO', 'archived'),
];
const result = dashboardTasks(input, '2026-12-31', (id) => id !== 'archived');
assert.deepEqual(
  result.overdue.map((t) => t.id),
  ['old'],
);
assert.deepEqual(
  result.upcoming.map((t) => t.id),
  ['today', 'boundary'],
);
assert.deepEqual(
  input.map((t) => t.id),
  ['old', 'today', 'boundary', 'later', 'done', 'archived'],
  'Input list is not mutated',
);
console.log(
  'PASS: overdue/upcoming separation, today boundary, year boundary, completed and archived exclusions.',
);
