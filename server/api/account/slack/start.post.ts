import { randomBytes } from 'node:crypto';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { hashSessionToken } from '#server/utils/session';
import { assertSlackChangeAllowed } from '#server/utils/slack-connection';
import { slackOAuthConfig, slackOAuthCookie, slackScopes } from '#server/utils/slack-oauth';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = slackOAuthConfig();
  await assertSlackChangeAllowed(user.id);
  const state = randomBytes(32).toString('hex');
  await query('DELETE FROM slack_oauth_states WHERE user_id=$1 OR expires_at <= now()', [user.id]);
  await query(
    "INSERT INTO slack_oauth_states (state_hash,user_id,session_hash,expires_at) VALUES ($1,$2,$3,now()+interval '10 minutes')",
    [hashSessionToken(state), user.id, hashSessionToken(getCookie(event, 'session')!)],
  );
  setCookie(event, slackOAuthCookie, state, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/api/account/slack',
    maxAge: 600,
  });
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({
    client_id: config.slackClientId,
    redirect_uri: config.slackRedirectUri,
    scope: slackScopes.join(','),
    state,
  }).toString();
  return { url: url.toString() };
});
