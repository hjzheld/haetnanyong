import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';

process.loadEnvFile();
const db = neon(process.env.DATABASE_URL);
function queries(file) {
  const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    ),
    result = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'query' &&
      node.arguments[0] &&
      (ts.isStringLiteral(node.arguments[0]) ||
        ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    )
      result.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
const taskCreate = queries('server/api/tasks/index.post.ts')[0];
const eventCreate = queries('server/api/events/index.post.ts')[0];
const taskUpdate = queries('server/api/tasks/[id].patch.ts')[0];
const eventUpdate = queries('server/api/events/[id].patch.ts').find((sql) =>
  sql.startsWith('UPDATE events'),
);
const calendar = queries('server/api/calendar.get.ts');
// Temporary tables shadow production tables only within this transaction.
// No real user data or Slack reservations are created or changed.
const results = await db.transaction([
  db.query('CREATE TEMP TABLE projects (LIKE public.projects INCLUDING ALL) ON COMMIT DROP'),
  db.query('CREATE TEMP TABLE tasks (LIKE public.tasks INCLUDING ALL) ON COMMIT DROP'),
  db.query('CREATE TEMP TABLE events (LIKE public.events INCLUDING ALL) ON COMMIT DROP'),
  db.query("INSERT INTO projects (user_id,name,color) VALUES (101,'color regression','#123456')"),
  db.query(taskCreate, [
    101,
    null,
    'standalone',
    null,
    '2026-10-21',
    '2026-10-22',
    'MEDIUM',
    '#C98B8B',
  ]),
  db.query(eventCreate, [
    101,
    null,
    'timed',
    null,
    false,
    '2026-10-21T14:00:00+09:00',
    '2026-10-21T15:00:00+09:00',
    null,
    null,
    '#8E8AA3',
  ]),
  db.query(taskCreate, [
    101,
    '1',
    'project task',
    null,
    '2026-10-21',
    '2026-10-22',
    'HIGH',
    '#C98B8B',
  ]),
  db.query(eventCreate, [
    101,
    '1',
    'all day',
    null,
    true,
    null,
    null,
    '2026-10-21',
    '2026-10-22',
    '#8E8AA3',
  ]),
  db.query(taskCreate, [
    202,
    '1',
    'foreign project',
    null,
    '2026-10-21',
    '2026-10-22',
    'LOW',
    '#C98B8B',
  ]),
  db.query(taskUpdate, [null, null, null, null, null, null, '1', 101, false, '#AABBCC']),
  db.query(eventUpdate, [null, null, null, null, null, null, '1', 101, false, '#DDEEFF']),
  db.query(taskUpdate, [null, null, null, null, null, null, '1', 202, false, '#000000']),
  db.query(eventUpdate, [null, null, null, null, null, null, '1', 202, false, '#000000']),
  db.query(calendar[0], [101, '2026-10-01T00:00:00+09:00', '2026-11-01T00:00:00+09:00']),
  db.query(queries('server/api/tasks/index.get.ts')[0], [101, false]),
  db.query("UPDATE projects SET color='#654321' WHERE id=1"),
  db.query(calendar[0], [101, '2026-10-01T00:00:00+09:00', '2026-11-01T00:00:00+09:00']),
  db.query(queries('server/api/events/[id].delete.ts')[1], ['1', 202]),
  db.query(queries('server/api/events/[id].delete.ts')[1], ['1', 101]),
  db.query(queries('server/api/tasks/index.get.ts')[0], [101, true]),
  db.query(queries('server/api/events/index.get.ts')[0], [101, true]),
  db.query(queries('server/api/tasks/[id].get.ts')[0], ['1', 101]),
  db.query(queries('server/api/tasks/[id].get.ts')[0], ['1', 202]),
  db.query(queries('server/api/events/[id].get.ts')[0], ['2', 101]),
  db.query(queries('server/api/events/[id].get.ts')[0], ['2', 202]),
  db.query(queries('server/api/tasks/index.get.ts')[0], [101, false]),
]);
assert.equal(results[4][0].color, '#C98B8B');
assert.equal(results[5][0].color, '#8E8AA3');
assert.equal(results[8].length, 0);
assert.equal(results[9][0].color, '#AABBCC');
assert.equal(results[10][0].color, '#DDEEFF');
assert.equal(results[11].length, 0);
assert.equal(results[12].length, 0);
assert.ok(results[13].every((r) => r.kind === 'event'));
assert.equal(results[13].find((r) => r.title === 'all day').color, '#123456');
assert.equal(results[13].find((r) => r.title === 'timed').color, '#DDEEFF');
assert.equal(results[14].find((r) => r.title === 'project task').color, '#123456');
assert.equal(results[14].find((r) => r.title === 'standalone').color, '#AABBCC');
assert.equal(results[16].find((r) => r.title === 'all day').color, '#654321');
assert.equal(results[17].length, 0);
assert.equal(results[18].length, 1);
assert.equal(results[19].length, 1);
assert.equal(results[19][0].projectId, null);
assert.equal(results[20].length, 0);
assert.equal(results[21][0].title, 'standalone');
assert.equal(results[22].length, 0);
assert.equal(results[23][0].title, 'all day');
assert.equal(results[24].length, 0);
assert.equal(results[25].length, 2);
console.log(
  'PASS: standalone lists/detail, detail ownership, task and event creation, color-only updates, calendar inheritance, project recoloring, and deletion (temporary tables only).',
);
