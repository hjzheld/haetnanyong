import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

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
const remove = load(
  'server/api/account/index.delete.ts',
  {
    '#server/utils/auth': { requireUser: async () => ({ id: 'owner' }) },
    '#server/utils/input': input,
    '#server/utils/password': { verifyPassword: async (value) => value === 'correct' },
    '#server/services/slack': {
      cancelSlackMessage: async () =>
        assert.fail('No messages should be canceled in this scenario'),
    },
    '#server/utils/db': {
      query: async (sql, args) => {
        assert.equal(args[0], 'owner');
        if (sql.includes('SELECT password_hash')) return [{ passwordHash: 'hash' }];
        if (sql.includes('SELECT r.id')) return unresolved ? [{ id: 'unknown' }] : [];
        if (sql.includes('SELECT delete_user_account')) deletes++;
        return [];
      },
    },
  },
  { readBody: async () => ({ password }), deleteCookie: () => {} },
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
console.log(
  'PASS: strict IDs and timestamps, account-deletion safety, calendar ranges. No external writes.',
);
