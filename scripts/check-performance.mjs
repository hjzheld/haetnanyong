import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { scryptSync } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, overrides = {}, globals = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(
    readFileSync(path, 'utf8')
      .replaceAll('import.meta.server', 'false')
      .replaceAll('import.meta.client', 'true'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  vm.runInNewContext(
    js,
    {
      module,
      exports: module.exports,
      Buffer,
      performance,
      require: (id) => overrides[id] ?? require(id),
      ...globals,
    },
    { filename: path },
  );
  return module.exports;
}

const password = load('server/utils/password.ts');
const salt = '1234567890abcdef1234567890abcdef';
const legacyHash = `${salt}:${scryptSync('old-password', salt, 64).toString('hex')}`;
let yielded = false;
const work = password.verifyPassword('old-password', legacyHash);
setImmediate(() => {
  yielded = true;
});
assert.equal(await work, true, 'Existing scrypt hashes remain valid');
assert.equal(yielded, true, 'Password derivation must yield to other server requests');
assert.equal(await password.verifyPassword('wrong', legacyHash), false);
assert.equal(await password.verifyPassword('old-password', 'invalid-hash'), false);
const nextHash = await password.hashPassword('new-password');
assert.match(nextHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
assert.equal(await password.verifyPassword('new-password', nextHash), true);

let queries = 0;
const { requireUser } = load(
  'server/utils/auth.ts',
  {
    '#server/utils/db': {
      query: async (_, args) => {
        queries++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [{ id: args[0], email: 'qa@example.test', nickname: 'QA' }];
      },
    },
    '#server/utils/session': { hashSessionToken: (value) => value },
  },
  {
    getCookie: (event) => event.token,
    appendResponseHeader: () => {},
    createError: (details) => Object.assign(new Error(details.statusMessage), details),
  },
);
const event = { context: {}, token: 'user-a' };
const users = await Promise.all(Array.from({ length: 4 }, () => requireUser(event)));
assert.equal(queries, 1, 'Parallel handlers share only the current request authentication');
assert.ok(users.every((user) => user.id === 'user-a'));
assert.equal((await requireUser({ context: {}, token: 'user-b' })).id, 'user-b');
assert.equal(queries, 2, 'Authentication must not be cached across requests/users');
await assert.rejects(
  () => requireUser({ context: {} }),
  (error) => error.statusCode === 401,
);

const states = new Map();
const app = {};
let sessionQueries = 0;
let authenticated = false;
const { useSession } = load(
  'app/composables/useSession.ts',
  {},
  {
    useState: (key, init) => {
      if (!states.has(key)) states.set(key, { value: init() });
      return states.get(key);
    },
    useNuxtApp: () => app,
    useRequestFetch: () => async () => {
      sessionQueries++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (!authenticated) throw { statusCode: 401 };
      return { user: { id: '1', email: 'qa@example.test', nickname: 'QA' } };
    },
  },
);
await Promise.all([useSession().restore(), useSession().restore()]);
assert.equal(sessionQueries, 1, 'Concurrent session restore is deduplicated per app');
await useSession().restore();
assert.equal(sessionQueries, 1, 'Anonymous session result is reused');
authenticated = true;
useSession().setUser({ id: '1' });
await useSession().restore();
assert.equal(sessionQueries, 1, 'Login result avoids a redundant /auth/me request');
states.get('session-checked-at').value = 0;
await useSession().restore();
assert.equal(sessionQueries, 2, 'Expired session state revalidates');
assert.equal(useSession().user.value.id, '1');
states.get('session-checked-at').value = 0;
const oldRestore = useSession().restore();
useSession().setUser(null);
await oldRestore;
assert.equal(useSession().user.value, null, 'Late restoration cannot undo logout');
states.get('session-checked-at').value = 0;
const previousAccount = useSession().restore();
useSession().setUser({ id: 'new-account' });
await previousAccount;
assert.equal(
  useSession().user.value.id,
  'new-account',
  'Late restoration cannot replace a new login',
);
let rejectRequest;
let redirects = 0;
const { useApi } = load(
  'app/composables/useApi.ts',
  {},
  {
    useState: (key, init) => {
      if (!states.has(key)) states.set(key, { value: init() });
      return states.get(key);
    },
    useRoute: () => ({ path: '/plans', fullPath: '/plans' }),
    useRequestFetch: () => () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
    clearNuxtData: () => {},
    navigateTo: async () => {
      redirects++;
    },
  },
);
const api = useApi();
const oldRequest = api.request('/api/projects');
useSession().setUser({ id: 'latest-login' });
rejectRequest({ statusCode: 401 });
await assert.rejects(oldRequest);
assert.equal(useSession().user.value.id, 'latest-login');
assert.equal(redirects, 0, 'Old API responses must not log out a new session');
const expiredRequest = api.request('/api/projects');
rejectRequest({ statusCode: 401 });
await assert.rejects(expiredRequest);
assert.equal(useSession().user.value, null);
assert.equal(redirects, 1, 'A current session expiry must still redirect');
console.log(
  'PASS: non-blocking password hashes, legacy compatibility, request-scoped authentication and session deduplication. No external writes.',
);
