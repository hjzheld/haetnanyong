import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, overrides = {}, globals = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(path, 'utf8').replaceAll('import.meta.dev', 'false'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    js,
    {
      module,
      exports: module.exports,
      Buffer,
      URL,
      URLSearchParams,
      require: (id) => overrides[id] ?? require(id),
      ...globals,
    },
    { filename: path },
  );
  return module.exports;
}
const config = {
  slackClientId: 'test-client',
  slackClientSecret: 'test-secret',
  slackRedirectUri: 'https://example.test/api/account/slack/callback',
  slackTokenEncryptionKey: '0123456789abcdef'.repeat(4),
  slackBotToken: 'legacy-token',
};
const globals = {
  useRuntimeConfig: () => config,
  createError: (data) => Object.assign(new Error(data.statusMessage), data),
  defineEventHandler: (handler) => handler,
  getCookie: (event, key) => event.cookies[key],
  deleteCookie: () => {},
  setResponseHeader: () => {},
  getQuery: (event) => event.params,
  sendRedirect: (_event, url) => url,
};
const oauth = load('server/utils/slack-oauth.ts', {}, globals);
assert.equal(oauth.slackOAuthConfigured(), true);
const configuredClientId = config.slackClientId;
config.slackClientId = '';
assert.equal(oauth.slackOAuthConfigured(), false, 'Legacy bot token must not enable OAuth');
assert.ok(oauth.slackOAuthIssues().includes('SLACK_CLIENT_ID'));
config.slackClientId = configuredClientId;
const configuredKey = config.slackTokenEncryptionKey;
config.slackTokenEncryptionKey = 'short-key';
assert.equal(oauth.slackOAuthConfigured(), false, 'Short encryption keys are not configured');
config.slackTokenEncryptionKey = configuredKey;
const configuredRedirect = config.slackRedirectUri;
config.slackRedirectUri = 'http://example.test/api/account/slack/callback';
assert.equal(oauth.slackOAuthConfigured(), false, 'Invalid redirect must not enable OAuth');
config.slackRedirectUri = configuredRedirect;
const sealed = oauth.encryptSlackToken('workspace-one-token', 'TONE');
assert.ok(!sealed.includes('workspace-one-token'));
assert.equal(oauth.decryptSlackToken(sealed, 'TONE'), 'workspace-one-token');
assert.throws(() => oauth.decryptSlackToken(sealed, 'TOTHER'));
const tampered = Buffer.from(sealed, 'base64url');
tampered[tampered.length - 1] ^= 1;
assert.throws(() => oauth.decryptSlackToken(tampered.toString('base64url'), 'TONE'));

const auth = { requireUser: async () => ({ id: '1' }) };
const session = {
  hashSessionToken: (token) =>
    require('node:crypto').createHash('sha256').update(token).digest('hex'),
};
let consumed = false,
  exchanges = 0,
  writes = 0,
  blocked = false,
  failedExchange = false;
const callback = load(
  'server/api/account/slack/callback.get.ts',
  {
    '#server/utils/auth': auth,
    '#server/utils/session': session,
    '#server/utils/slack-oauth': oauth,
    '#server/utils/slack-connection': {
      assertSlackChangeAllowed: async () => {
        if (blocked) throw Object.assign(new Error(), { statusCode: 409 });
      },
    },
    '#server/utils/db': {
      query: async (sql, args) => {
        if (sql.startsWith('DELETE FROM slack_oauth_states')) {
          if (consumed || args[1] !== '1' || args[2] !== session.hashSessionToken('session-one'))
            return [];
          consumed = true;
          return [{ user_id: '1' }];
        }
        writes++;
        assert.equal(args[1], 'TONE');
        assert.equal(oauth.decryptSlackToken(args[2], 'TONE'), 'workspace-one-token');
        assert.equal(args[4], 'UONE');
        return [{ id: '1' }];
      },
    },
    '#server/services/slack': {
      callSlack: async (method, body, token) => {
        assert.equal(token, 'workspace-one-token');
        assert.ok(
          method === 'users.info' || method === 'conversations.open',
          'No unsolicited message sent',
        );
        if (method === 'users.info') return { ok: true, user: { id: 'UONE', team_id: 'TONE' } };
        assert.equal(body.users, 'UONE');
        return { ok: true, channel: { id: 'DONE' } };
      },
    },
  },
  {
    ...globals,
    $fetch: async (_url, options) => {
      exchanges++;
      assert.equal(options.retry, 0);
      assert.equal(options.body.get('redirect_uri'), config.slackRedirectUri);
      if (failedExchange) throw new Error('secret-value-must-not-leak');
      return {
        ok: true,
        token_type: 'bot',
        scope: oauth.slackScopes.join(','),
        access_token: 'workspace-one-token',
        team: { id: 'TONE' },
        authed_user: { id: 'UONE' },
      };
    },
  },
).default;
const state = 'a'.repeat(64);
function event(params = {}, cookies = {}) {
  return {
    params: { state, code: 'code-one', ...params },
    cookies: { slack_oauth_state: state, session: 'session-one', ...cookies },
  };
}
assert.match(await callback(event({ state: 'b'.repeat(64) })), /invalid-state$/);
assert.equal(exchanges, 0);
assert.match(await callback(event({}, { session: 'other-session' })), /invalid-state$/);
assert.equal(exchanges, 0);
assert.match(await callback(event({ error: 'access_denied' })), /canceled$/);
assert.equal(exchanges, 0);
consumed = false;
blocked = true;
assert.match(await callback(event()), /reminders-active$/);
assert.equal(exchanges, 0);
consumed = false;
blocked = false;
failedExchange = true;
assert.equal(await callback(event()), '/slack/callback?result=failed');
failedExchange = false;
consumed = false;
assert.match(await callback(event()), /connected$/);
assert.equal(writes, 1);
const priorExchanges = exchanges;
assert.match(await callback(event()), /invalid-state$/);
assert.equal(exchanges, priorExchanges, 'Replayed callback cannot exchange its code twice');

// Scheduled message cancellation after account deletion must use its installation token.
const tokens = [];
const slack = load(
  'server/services/slack.ts',
  {
    '#server/utils/slack-oauth': oauth,
    '#server/utils/db': {
      query: async (_sql, args) =>
        args[0] === 'DONE' ? [{ token: sealed, workspace: 'TONE' }] : [],
    },
  },
  {
    ...globals,
    $fetch: async (_url, options) => {
      tokens.push(options.headers.Authorization);
      return { ok: true };
    },
  },
);
await slack.scheduleSlackMessage('DONE', 'test', 9999999999);
await slack.cancelSlackMessage('DONE', 'scheduled-one');
await slack.cancelSlackMessage('DLEGACY', 'scheduled-old');
assert.deepEqual(tokens, [
  'Bearer workspace-one-token',
  'Bearer workspace-one-token',
  'Bearer legacy-token',
]);
console.log(
  'PASS: OAuth session/state/replay/denial/error handling, authenticated encryption, installation token routing. No network or database writes.',
);
