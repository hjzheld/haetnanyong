import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url),
  cookies = new Map(),
  calls = [],
  modules = new Map();
let body = {},
  user = { id: '1', email: 'qa@example.test', nickname: '테스트냥' },
  active = false,
  profileWrites = 0,
  connectionWrites = 0;
const globals = {
  Buffer,
  console,
  Date,
  defineEventHandler: (f) => f,
  createError: (v) => Object.assign(new Error(v.statusMessage), v),
  useRuntimeConfig: () => ({ sessionSecret: 'local-test-only', slackBotToken: 'local-test-token' }),
  readBody: async () => body,
  getCookie: (_, k) => cookies.get(k),
  setCookie: (_, k, v) => cookies.set(k, v),
  deleteCookie: (_, k) => cookies.delete(k),
};
const db = {
  query: async (sql, args) => {
    if (sql.includes('SELECT r.id')) return active ? [{ id: '1' }] : [];
    if (sql.includes('SELECT password_hash'))
      return [{ password_hash: await password.hashPassword('old-password') }];
    if (sql.includes('WITH updated')) {
      profileWrites++;
      return [{ ...user, nickname: args[0], email: args[1] }];
    }
    if (sql.includes('UPDATE users')) {
      connectionWrites++;
      return [];
    }
    return [];
  },
};
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(path, 'utf8').replaceAll('!import.meta.dev', 'false'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const localRequire = (id) =>
    id === '#server/utils/auth'
      ? { requireUser: async () => user }
      : id === '#server/utils/db'
        ? db
        : id === '#server/services/slack'
          ? {
              callSlack: async (method, payload) => {
                calls.push({ method, payload });
                return method === 'auth.test'
                  ? { ok: true, team_id: 'T01234567' }
                  : method === 'users.info'
                    ? { ok: true, user: { id: payload.user, team_id: 'T01234567' } }
                    : method === 'conversations.open'
                      ? { ok: true, channel: { id: 'D01234567' } }
                      : { ok: true };
              },
            }
          : id.startsWith('#server/')
            ? load(id.replace('#server/', 'server/') + '.ts')
            : require(id);
  vm.runInNewContext(
    source,
    { ...globals, module, exports: module.exports, require: localRequire },
    { filename: path },
  );
  modules.set(path, module.exports);
  return module.exports;
}
const password = load('server/utils/password.ts'),
  profile = load('server/api/account/profile.patch.ts').default;
cookies.set('session', 'test-session');
body = { email: user.email, nickname: '새닉네임' };
assert.equal((await profile({})).user.nickname, '새닉네임');
body = { email: user.email, nickname: '냥' };
await assert.rejects(
  () => profile({}),
  (e) => e.statusCode === 400,
);
body = { email: 'new@example.test', nickname: '새닉네임', currentPassword: 'wrong' };
await assert.rejects(
  () => profile({}),
  (e) => e.statusCode === 409 && /verification/.test(e.message),
);
body = {
  email: user.email,
  nickname: '새닉네임',
  currentPassword: 'old-password',
  newPassword: 'short',
};
await assert.rejects(
  () => profile({}),
  (e) => e.statusCode === 400,
);
body = {
  email: user.email,
  nickname: '새닉네임',
  currentPassword: 'old-password',
  newPassword: 'new-password',
};
await assert.rejects(
  () => profile({}),
  (e) => e.statusCode === 400,
);
body = { email: 'new@example.test', nickname: '새닉네임', currentPassword: 'old-password' };
await assert.rejects(
  () => profile({}),
  (e) => e.statusCode === 409 && /verification/.test(e.message),
);
assert.equal(profileWrites, 1, 'Blocked email changes must not write user data');
const changePassword = load('server/api/account/password.patch.ts').default;
body = { currentPassword: 'wrong', newPassword: 'new-password' };
await assert.rejects(
  () => changePassword({}),
  (e) => e.statusCode === 400,
);
body = { currentPassword: 'old-password', newPassword: 'short' };
await assert.rejects(
  () => changePassword({}),
  (e) => e.statusCode === 400,
);
body = { currentPassword: 'old-password', newPassword: 'new-password' };
assert.equal((await changePassword({})).ok, true);
assert.equal(profileWrites, 2);
cookies.set('session', 'test-session');
const challenge = load('server/api/account/slack/challenge.post.ts').default,
  verify = load('server/api/account/slack/verify.post.ts').default,
  disconnect = load('server/api/account/slack.delete.ts').default;
body = { memberId: 'bad' };
await assert.rejects(
  () => challenge({}),
  (e) => e.statusCode === 400,
);
body = { memberId: 'U01234567' };
await challenge({});
assert.ok(cookies.get('slack_challenge'));
assert.equal(calls.filter((c) => c.method === 'chat.postMessage').length, 1);
await assert.rejects(
  () => challenge({}),
  (e) => e.statusCode === 429,
);
body = { code: 'WRONG' };
await assert.rejects(
  () => verify({}),
  (e) => e.statusCode === 400,
);
const code = calls
  .find((c) => c.method === 'chat.postMessage')
  .payload.text.match(/코드: ([A-F0-9]{12})/)[1];
body = { code };
user = { ...user, id: '2' };
await assert.rejects(
  () => verify({}),
  (e) => e.statusCode === 400,
);
user = { ...user, id: '1' };
active = true;
await assert.rejects(
  () => verify({}),
  (e) => e.statusCode === 409,
);
await assert.rejects(
  () => disconnect({}),
  (e) => e.statusCode === 409,
);
active = false;
await verify({});
assert.equal(connectionWrites, 1);
assert.ok(!cookies.has('slack_challenge'));
await assert.rejects(
  () => verify({}),
  (e) => e.statusCode === 400,
);
await disconnect({});
assert.equal(connectionWrites, 2);
console.log(
  'PASS: profile validation/current password; Slack member validation, DM challenge, cooldown, wrong code, user binding, active-reminder guards, successful verification, cookie consumption, disconnect. DB and Slack mocked; no external messages or writes.',
);
