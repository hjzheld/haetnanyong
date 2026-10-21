import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['app/utils/dashboard.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { dashboardTasks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
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
