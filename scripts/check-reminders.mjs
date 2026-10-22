import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const globals = {
  createError: (value) => Object.assign(new Error(value.statusMessage), value),
  useRuntimeConfig: () => ({ slackBotToken: 'test-token' }),
  defineEventHandler: (fn) => fn,
  setResponseHeader: () => {},
};
function load(path, modules, extra = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: (id) => modules[id] ?? require(id),
      URLSearchParams,
      structuredClone,
      Buffer,
      ...globals,
      ...extra,
    },
    { filename: path },
  );
  return module.exports;
}

let pages = [],
  httpError,
  lastSlackRequest;
const slack = load(
  'server/services/slack.ts',
  {
    '#server/utils/db': { query: async () => [] },
    '#server/utils/slack-oauth': { decryptSlackToken: () => 'test-token' },
  },
  {
    $fetch: async (_url, options) => {
      lastSlackRequest = options;
      options.onResponse?.({
        response: { headers: new Headers({ 'x-slack-req-id': 'req-test-1' }) },
      });
      if (httpError) throw httpError;
      return pages.shift();
    },
  },
);
for (const [code, rejected] of [
  ['messages_tab_disabled', true],
  ['missing_scope', true],
  ['time_in_past', true],
  ['internal_error', false],
]) {
  pages = [{ ok: false, error: code }];
  await assert.rejects(
    slack.scheduleSlackMessage('D1', 'hello', 123),
    (error) => slack.slackFailure(error).rejected === rejected,
  );
  assert.equal(lastSlackRequest.body.post_at, 123);
  assert.equal(lastSlackRequest.headers['Content-Type'], 'application/json; charset=utf-8');
}
pages = [{ ok: false, error: 'internal_error' }];
await assert.rejects(
  slack.scheduleSlackMessage('D1', 'hello', 123),
  (error) =>
    error.data.slackRequestId === 'req-test-1' &&
    error.data.method === 'chat.scheduleMessage' &&
    error.data.outcome === 'unknown',
);
httpError = { response: { status: 429, headers: new Headers({ 'retry-after': '30' }) } };
await assert.rejects(
  slack.scheduleSlackMessage('D1', 'hello', 123),
  (error) =>
    error.statusCode === 429 && error.data.retryAfter === 30 && slack.slackFailure(error).rejected,
);
httpError = new Error('network');
await assert.rejects(
  slack.scheduleSlackMessage('D1', 'hello', 123),
  (error) => !slack.slackFailure(error).rejected,
);
httpError = undefined;
pages = [
  { ok: true, scheduled_messages: [{ id: 'Q1' }], response_metadata: { next_cursor: 'next' } },
  { ok: true, scheduled_messages: [{ id: 'Q2' }] },
];
assert.equal((await slack.listScheduledSlackMessages('D1')).length, 2);
pages = [{ ok: true }];
await assert.rejects(slack.listScheduledSlackMessages('D1'), /incomplete/);

let row,
  scheduled = [],
  listError,
  deletes = 0,
  updates = 0;
const db = {
  query: async (sql, args) => {
    if (sql.startsWith('SELECT')) {
      assert.match(sql, /e.user_id=\$2/);
      return row && args[1] === 'owner' ? [{ ...row }] : [];
    }
    updates++;
    if (sql.includes('reservation_accepted_at=CASE')) {
      assert.match(sql, /COALESCE\(last_error_code,'delivery_unverified'\)/);
      assert.match(
        sql,
        /COALESCE\(last_error_message,'Scheduled time passed; delivery is unverified'\)/,
      );
      assert.equal(args[5], row.revision);
      assert.equal(args[7], row.updatedAt);
      row.status = args[0];
      row.message = args[1] || row.message;
    } else if (sql.includes("SET status='CANCEL_PENDING'")) row.status = 'CANCEL_PENDING';
    else if (sql.includes("SET status='CANCELED'")) row.status = 'CANCELED';
    else if (sql.includes("SET status='CANCEL_FAILED'")) row.status = 'CANCEL_FAILED';
    return [{ ...row }];
  },
};
const reminders = load('server/services/reminders.ts', {
  '#server/utils/db': db,
  '#server/services/slack': {
    ...slack,
    listScheduledSlackMessages: async () => {
      if (listError) throw listError;
      return scheduled;
    },
    cancelSlackMessage: async () => {
      deletes++;
      throw new Error('Slack chat.deleteScheduledMessage failed: invalid_scheduled_message_id');
    },
  },
});
function reset(status = 'UNKNOWN') {
  const remindAt = new Date(Date.now() + 600_000).toISOString();
  row = {
    id: '1',
    status,
    revision: 3,
    channel: 'D1',
    message: null,
    key: reminders.reminderKey('4', remindAt, 'hello'),
    remindAt,
    updatedAt: new Date(Date.now() - 180_000).toISOString(),
  };
  scheduled = [];
  listError = undefined;
  updates = 0;
}
reset();
row.updatedAt = new Date().toISOString();
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'UNKNOWN');
assert.equal(updates, 0, 'In-flight scheduling is never reclaimed');
reset();
scheduled = [
  {
    id: 'Q1',
    channel_id: 'D1',
    post_at: Math.floor(Date.parse(row.remindAt) / 1000),
    text: 'hello',
  },
];
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'SCHEDULED');
assert.equal(row.message, 'Q1', 'Recover a lost reservation ID');
reset();
row.key = '4:' + row.remindAt;
scheduled = [
  {
    id: 'other',
    channel_id: 'D1',
    post_at: Math.floor(Date.parse(row.remindAt) / 1000),
    text: 'other message',
  },
];
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'UNKNOWN');
assert.equal(updates, 0, 'Do not claim ambiguous legacy reservations');
reset();
listError = new Error('Slack unavailable');
await assert.rejects(reminders.reconcileReminder('1', 'owner'));
assert.equal(updates, 0, 'An unavailable list cannot prove absence');
reset();
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'FAILED');
reset();
row.remindAt = new Date(Date.now() - 600_000).toISOString();
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'ELAPSED');
reset('CANCEL_PENDING');
assert.equal((await reminders.reconcileReminder('1', 'owner')).status, 'CANCELED');
reset('SCHEDULED');
row.updatedAt = new Date().toISOString();
row.message = 'already-gone';
await reminders.cancelReminder('1', 'owner');
assert.equal(row.status, 'CANCELED');
assert.equal(deletes, 1, 'Already removed reservation is an idempotent cancellation');
reset();
await assert.rejects(
  reminders.reconcileReminder('1', 'other'),
  (error) => error.statusCode === 404,
);

// UI elapsed states must not leave event edits and Slack changes permanently
// blocked by a SCHEDULED database row. Slack absence must be checked first.
let guardRows = [],
  guardMessages = [],
  guardListError,
  guardLists = 0;
const activeStatuses = new Set(['CANCELED', 'FAILED', 'ELAPSED']);
const guardService = load('server/services/reminders.ts', {
  '#server/services/slack': {
    ...slack,
    listScheduledSlackMessages: async () => {
      guardLists++;
      if (guardListError) throw guardListError;
      return guardMessages;
    },
  },
  '#server/utils/db': {
    query: async (sql, args) => {
      if (sql.startsWith('SELECT') && sql.includes('updated_at::text')) {
        assert.equal(args[1], 'owner');
        return guardRows.filter((r) => r.id === args[0]).map((r) => ({ ...r }));
      }
      if (sql.startsWith('SELECT')) {
        assert.equal(args[0], 'owner');
        return guardRows
          .filter((r) => !activeStatuses.has(r.status) && (!args[1] || r.eventId === args[1]))
          .map((r) => ({ ...r }));
      }
      const current = guardRows.find((r) => r.id === args[4]);
      assert.ok(current);
      current.status = args[0];
      return [{ ...current }];
    },
  },
});
function guardReset(status = 'SCHEDULED', future = false) {
  guardRows = [
    {
      id: '1',
      eventId: '4',
      status,
      revision: 1,
      channel: 'D1',
      message: 'Q1',
      key: '',
      remindAt: new Date(Date.now() + (future ? 600_000 : -600_000)).toISOString(),
      updatedAt: new Date(Date.now() - 180_000).toISOString(),
    },
  ];
  guardLists = 0;
  guardMessages = [];
  guardListError = undefined;
}
guardReset();
assert.equal(await guardService.hasActiveReminders('owner', '4'), false);
assert.equal(guardRows[0].status, 'ELAPSED');
assert.equal(guardLists, 1);
guardReset();
guardMessages = [{ id: 'Q1', channel_id: 'D1' }];
assert.equal(await guardService.hasActiveReminders('owner', '4'), true);
assert.equal(guardRows[0].status, 'SCHEDULED', 'Pending Slack messages continue to block edits');
guardReset();
guardListError = new Error('Slack unavailable');
await assert.rejects(guardService.hasActiveReminders('owner'), /unavailable/);
assert.equal(guardRows[0].status, 'SCHEDULED', 'A failed list cannot release an active guard');
for (const [status, future] of [
  ['UNKNOWN', false],
  ['SCHEDULED', true],
]) {
  guardReset(status, future);
  assert.equal(await guardService.hasActiveReminders('owner'), true);
  assert.equal(guardLists, 0, 'Future and uncertain reservations do not trigger extra Slack calls');
}
guardReset();
guardRows.push({ ...guardRows[0], id: '2', eventId: '5', message: 'Q2' });
assert.equal(await guardService.hasActiveReminders('owner'), false);
assert.equal(guardLists, 1, 'Elapsed reservations share one complete list per channel');
guardReset();
assert.equal(await guardService.hasActiveReminders('owner', 'other-event'), false);
assert.equal(guardLists, 0, 'An unrelated event never triggers a Slack lookup');

// Check schedule handler persistence: explicit rejection is retryable; ambiguous failure is not.
for (const [code, expected] of [
  ['missing_scope', 'FAILED'],
  ['internal_error', 'UNKNOWN'],
]) {
  let writtenStatus;
  let checkedPastReservation = 0;
  const handler = load(
    'server/api/reminders/index.post.ts',
    {
      '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
      '#server/utils/input': {
        inputBody: (x) => x,
        inputId: (x) => x,
        inputText: (x) => x,
        inputTime: (x) => x,
      },
      '#server/services/reminders': {
        ...reminders,
        reconcileReminder: async (id, userId) => {
          assert.equal(id, 'previous');
          assert.equal(userId, 'owner');
          checkedPastReservation++;
        },
      },
      '#server/services/slack': {
        ...slack,
        scheduleSlackMessage: async (channel, text) => {
          assert.equal(channel, 'D1');
          assert.equal(text, ':paw_prints: 했냐옹\nhello', 'Server must add the fixed heading');
          throw new Error('Slack chat.scheduleMessage failed: ' + code);
        },
      },
      '#server/utils/db': {
        query: async (sql, args) => {
          if (sql.startsWith('SELECT id,status,remind_at'))
            return [
              {
                id: 'previous',
                status: 'SCHEDULED',
                remindAt: new Date(Date.now() - 1000).toISOString(),
              },
            ];
          if (sql.startsWith('SELECT')) return [{ channel: 'D1', is_all_day: false }];
          if (sql.startsWith('INSERT')) return [{ id: '1', revision: 1 }];
          writtenStatus = args[0];
          return [];
        },
      },
    },
    {
      readBody: async () => ({
        eventId: '4',
        text: 'hello',
        scheduledAt: new Date(Date.now() + 600_000).toISOString(),
      }),
    },
  ).default;
  await assert.rejects(handler({}));
  assert.equal(
    checkedPastReservation,
    1,
    'Past scheduled reservations must be reconciled before replacement',
  );
  assert.equal(writtenStatus, expected);
}

const accountPaths = load('server/utils/account-openapi.ts', {}).accountPaths;
const openapi = load('server/utils/openapi.ts', {
  '#server/utils/account-openapi': { accountPaths },
}).openapi;
const document = load('server/api/openapi.get.ts', {
  '#server/utils/openapi': { openapi },
}).default();
assert.ok(document.paths['/reminders/{id}/reconcile'].post.security.length);
assert.ok(document.paths['/health/slack'].get.security.length);
assert.ok(document.paths['/account/slack/health'].get.security.length);
assert.equal(
  document.paths['/reminders'].post.requestBody.content['application/json'].schema.properties.text
    .maxLength,
  3983,
);

console.log(
  'PASS: reminder failure classification, Retry-After, pagination, in-flight protection, recovery, ambiguity, expiry, cancellation, ownership, elapsed edit/connection guards and schedule persistence. No external messages or database writes.',
);
