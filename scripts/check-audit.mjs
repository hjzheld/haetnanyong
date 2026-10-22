import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadTsModule } from './load-ts-module.mjs';

function load(file, modules = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(file, 'utf8').replaceAll('import.meta.dev', 'false'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (key) => modules[key],
    defineEventHandler: (handler) => handler,
    createError: (value) => Object.assign(new Error(value.statusMessage), value),
    ...globals,
  });
  return module.exports;
}
const input = load('server/utils/input.ts');
assert.throws(
  () => input.inputDate('0000-01-01', 'startDate'),
  (error) => error.statusCode === 400,
);
for (const value of [
  ['1'],
  {},
  1.2,
  Number.MAX_SAFE_INTEGER + 1,
  null,
  true,
  '9223372036854775808',
])
  assert.throws(
    () => input.inputId(value),
    (e) => e.statusCode === 400,
  );
assert.equal(input.inputId('9223372036854775807'), '9223372036854775807');
assert.equal(input.inputId(1), '1');
for (const value of [
  '2026-02-30T12:00:00+09:00',
  '2025-02-29T12:00:00Z',
  '2026-10-22T24:00:00Z',
  '2026-10-22T12:60:00Z',
  '2026-10-22T12:00:60Z',
  '2026-10-22T12:00:00',
  null,
])
  assert.throws(
    () => input.inputTime(value, 'scheduledAt'),
    (e) => e.statusCode === 400,
  );
for (const value of ['2024-02-29T12:00:00+09:00', '2026-10-22T12:00Z', '2026-10-22T12:00:00.123Z'])
  assert.equal(input.inputTime(value, 'scheduledAt'), value);

let password = 'wrong';
let unresolved = false;
let deletes = 0;
let deletionClock = Date.now();
let cancellations = [];
let cancellationCalls = 0;
let queuedCancellations = [];
const remove = load(
  'server/api/account/index.delete.ts',
  {
    '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
    '#server/utils/input': input,
    '#server/utils/password': { verifyPassword: async (value) => value === 'correct' },
    '#server/services/slack': {
      cancelSlackMessage: async () => {
        cancellationCalls++;
        deletionClock += 15_000;
      },
    },
    '#server/utils/db': {
      query: async (sql, args) => {
        assert.equal(args[0], 'owner');
        if (sql.includes('SELECT password_hash')) return [{ passwordHash: 'hash' }];
        if (sql.includes('SELECT r.id')) return unresolved ? [{ id: 'unknown' }] : [];
        if (sql.includes('SELECT r.slack_dm_channel_id')) return cancellations;
        if (sql.includes('SELECT delete_user_account')) {
          deletes++;
          queuedCancellations = JSON.parse(args[1]);
        }
        return [];
      },
    },
  },
  {
    readBody: async () => ({ password }),
    deleteCookie: () => {},
    Date: class extends Date {
      static now() {
        return deletionClock;
      }
    },
  },
).default;
await assert.rejects(remove({}), (error) => error.statusCode === 400);
assert.equal(deletes, 0, 'Wrong password must not delete the account or expire its session');
password = 'correct';
unresolved = true;
await assert.rejects(remove({}), (error) => error.statusCode === 409);
assert.equal(deletes, 0, 'Unresolved reservations must survive account deletion attempts');
unresolved = false;
assert.equal((await remove({})).ok, true);
assert.equal(deletes, 1);
assert.equal(cancellationCalls, 0);
cancellations = ['1', '2', '3'].map((scheduledMessageId) => ({
  channelId: 'DTEST',
  scheduledMessageId,
  remindAt: new Date(deletionClock + 86400_000).toISOString(),
}));
assert.equal((await remove({})).pendingSlackCancellations, 2);
assert.equal(cancellationCalls, 1, 'Do not start another slow cancellation after using the budget');
assert.equal(deletes, 2);
assert.deepEqual(
  queuedCancellations.map((job) => job.scheduledMessageId),
  ['2', '3'],
);
assert.ok(queuedCancellations.every((job) => job.errorCode === 'deferred_cancellation'));

let period = { from: '2026-01-01T00:00:00Z', to: '2028-01-01T00:00:00Z' };
let queries = 0;
const calendar = load(
  'server/api/calendar.get.ts',
  {
    '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
    '#server/utils/input': input,
    '#server/utils/db': {
      query: async (sql, params) => {
        queries++;
        assert.equal(params[0], 'owner');
        assert.match(sql, /e\.start_date::timestamp AT TIME ZONE 'Asia\/Seoul'/);
        assert.doesNotMatch(
          sql,
          /p\.archived_at IS NULL/,
          'Calendar history includes archived projects',
        );
        assert.match(sql, /WHERE e\.user_id=\$1/, 'Calendar must still enforce ownership');
        return [];
      },
    },
  },
  { getQuery: () => period },
).default;
await assert.rejects(calendar({}), (error) => error.statusCode === 400);
assert.equal(queries, 0);
period = { from: '2026-10-22T12:00:00+09:00', to: '2026-10-22T13:00:00+09:00' };
await calendar({});
assert.equal(queries, 1);

const { isProjectComplete } = await loadTsModule('app/utils/project-completion.ts');
const now = Date.parse('2026-10-22T12:00:00+09:00');
assert.equal(isProjectComplete([], [], now), false, 'Empty projects are not finished');
assert.equal(isProjectComplete([{ status: 'DONE' }], [], now), true);
assert.equal(isProjectComplete([{ status: 'IN_PROGRESS' }], [], now), false);
assert.equal(
  isProjectComplete([], [{ allDay: false, endsAt: '2026-10-22T12:00:00+09:00' }], now),
  true,
);
assert.equal(
  isProjectComplete([], [{ allDay: false, endsAt: '2026-10-22T12:01:00+09:00' }], now),
  false,
);
assert.equal(isProjectComplete([], [{ allDay: true, endDate: '2026-10-23' }], now), false);
assert.equal(isProjectComplete([], [{ allDay: true, endDate: '2026-10-22' }], now), true);
assert.equal(isProjectComplete([], [{ allDay: false, endsAt: null }], now), false);
const projectInput = load('server/utils/project-input.ts');
for (const body of [
  { archived: true, onlyIfComplete: 'true' },
  { archived: false, onlyIfComplete: true },
])
  assert.throws(
    () => projectInput.validateProjectInput(body),
    (error) => error.statusCode === 400,
  );
let projectBody = { archived: true, onlyIfComplete: true };
let projectOwned = true;
let projectComplete = false;
const updateProject = load(
  'server/api/projects/[id].patch.ts',
  {
    '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
    '#server/utils/input': input,
    '#server/utils/project-input': projectInput,
    '#server/utils/db': {
      query: async (sql, params) => {
        if (sql.startsWith('SELECT id')) {
          assert.equal(params[1], 'owner');
          return projectOwned ? [{ id: '1' }] : [];
        }
        assert.equal(params[5], 'owner');
        assert.match(sql, /NOT EXISTS \(SELECT 1 FROM tasks/);
        assert.match(sql, /e\.end_date::timestamp AT TIME ZONE 'Asia\/Seoul'/);
        return projectOwned && (!params[6] || projectComplete)
          ? [{ id: '1', archivedAt: 'now' }]
          : [];
      },
    },
  },
  { getRouterParam: () => '1', readBody: async () => projectBody },
).default;
await assert.rejects(updateProject({}), (error) => error.statusCode === 409);
projectOwned = false;
await assert.rejects(updateProject({}), (error) => error.statusCode === 404);
projectOwned = true;
projectComplete = true;
assert.equal((await updateProject({})).id, '1');
projectComplete = false;
projectBody = { archived: true };
assert.equal((await updateProject({})).id, '1', 'Manual archiving remains available');

for (const [resource, alias] of [
  ['tasks', 't'],
  ['events', 'e'],
]) {
  let owned = true;
  const detail = load(
    `server/api/${resource}/[id].get.ts`,
    {
      '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
      '#server/utils/input': input,
      '#server/utils/db': {
        query: async (sql, args) => {
          assert.deepEqual(Array.from(args), ['1', 'owner']);
          assert.ok(sql.includes(`COALESCE(p.color,${alias}.color) AS color`));
          assert.ok(sql.includes(`p.user_id=${alias}.user_id`));
          assert.ok(sql.includes(`${alias}.id=$1 AND ${alias}.user_id=$2`));
          return owned ? [{ id: '1', color: '#123456' }] : [];
        },
      },
    },
    { getRouterParam: () => '1' },
  ).default;
  assert.equal((await detail({})).color, '#123456');
  owned = false;
  await assert.rejects(detail({}), (error) => error.statusCode === 404);
}

let reminderActive = true;
let eventWrites = 0;
const editEvent = load(
  'server/api/events/[id].patch.ts',
  {
    '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
    '#server/utils/input': input,
    '#server/services/reminders': {
      hasActiveReminders: async (userId, eventId) => {
        assert.equal(userId, 'owner');
        assert.equal(eventId, '1');
        return reminderActive;
      },
    },
    '#server/utils/db': {
      query: async (_sql, args) => {
        eventWrites++;
        assert.equal(args[7], 'owner');
        return [{ id: '1' }];
      },
    },
  },
  { getRouterParam: () => '1', readBody: async () => ({ title: 'updated' }) },
).default;
await assert.rejects(editEvent({}), (error) => error.statusCode === 409);
assert.equal(eventWrites, 0, 'Active reminders must still protect event edits');
reminderActive = false;
assert.equal((await editEvent({})).id, '1');
assert.equal(eventWrites, 1);
console.log(
  'PASS: strict IDs and timestamps, account-deletion safety, calendar ranges, completion boundaries, guarded project archiving, inherited detail colors and reminder-protected event edits. No external writes.',
);
