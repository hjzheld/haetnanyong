import { timingSafeEqual } from 'node:crypto';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { hashSessionToken } from '#server/utils/session';
import { assertSlackChangeAllowed } from '#server/utils/slack-connection';
import { callSlack } from '#server/services/slack';
import {
  encryptSlackToken,
  slackOAuthConfig,
  slackOAuthCookie,
  slackScopes,
} from '#server/utils/slack-oauth';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');
  const finish = (result: string) => sendRedirect(event, `/slack/callback?result=${result}`, 303);
  const params = getQuery(event);
  const cookie = getCookie(event, slackOAuthCookie) || '';
  deleteCookie(event, slackOAuthCookie, { path: '/api/account/slack' });
  if (
    typeof params.state !== 'string' ||
    !/^[a-f0-9]{64}$/.test(params.state) ||
    !/^[a-f0-9]{64}$/.test(cookie) ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(params.state))
  )
    return finish('invalid-state');
  try {
    const user = await requireUser(event);
    const [state] = await query(
      'DELETE FROM slack_oauth_states WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING user_id',
      [hashSessionToken(params.state), user.id, hashSessionToken(getCookie(event, 'session')!)],
    );
    if (!state) return finish('invalid-state');
    if (params.error) return finish(params.error === 'access_denied' ? 'canceled' : 'failed');
    if (typeof params.code !== 'string' || !params.code || params.code.length > 2048)
      return finish('failed');
    const config = slackOAuthConfig();
    await assertSlackChangeAllowed(user.id);
    const access = await $fetch<{
      ok: boolean;
      access_token?: string;
      scope?: string;
      token_type?: string;
      team?: { id?: string };
      authed_user?: { id?: string };
      is_enterprise_install?: boolean;
      refresh_token?: string;
      expires_in?: number;
    }>('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      retry: 0,
      timeout: 15000,
      body: new URLSearchParams({
        client_id: config.slackClientId,
        client_secret: config.slackClientSecret,
        redirect_uri: config.slackRedirectUri,
        code: params.code,
      }),
    });
    if (
      !access.ok ||
      !access.access_token ||
      access.token_type !== 'bot' ||
      !access.team?.id ||
      !access.authed_user?.id ||
      access.is_enterprise_install
    )
      return finish('failed');
    // Refresh-token installations require a separate refresh lifecycle.
    if (access.refresh_token || access.expires_in) return finish('rotation-unsupported');
    if (!slackScopes.every((scope) => access.scope?.split(',').includes(scope)))
      return finish('missing-scope');
    const workspaceId = access.team.id;
    const memberId = access.authed_user.id;
    const info = await callSlack<{
      ok: boolean;
      user?: { id: string; team_id: string; is_bot?: boolean; deleted?: boolean };
    }>('users.info', { user: memberId }, access.access_token);
    if (
      !info.user ||
      info.user.team_id !== workspaceId ||
      info.user.id !== memberId ||
      info.user.deleted ||
      info.user.is_bot
    )
      return finish('failed');
    const dm = await callSlack<{ ok: boolean; channel?: { id: string } }>(
      'conversations.open',
      { users: memberId },
      access.access_token,
    );
    if (!dm.channel?.id) return finish('failed');
    // Atomically persist routing, credentials, and the account connection.
    const saved = await query(
      `WITH eligible AS (
      SELECT id FROM users WHERE id=$1 AND NOT EXISTS (
        SELECT 1 FROM reminders r JOIN events e ON e.id=r.event_id WHERE e.user_id=$1 AND r.status NOT IN ('CANCELED','FAILED','ELAPSED')
      ) FOR UPDATE
    ), installation AS (
      INSERT INTO slack_installations(workspace_id,encrypted_bot_token) SELECT $2,$3 FROM eligible
      ON CONFLICT(workspace_id) DO UPDATE SET encrypted_bot_token=EXCLUDED.encrypted_bot_token,updated_at=now() RETURNING workspace_id
    ), channel AS (
      INSERT INTO slack_channel_installations(channel_id,workspace_id) SELECT $4,workspace_id FROM installation
      ON CONFLICT(channel_id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id RETURNING channel_id
    ) UPDATE users SET slack_workspace_id=$2,slack_user_id=$5,slack_dm_channel_id=channel.channel_id,slack_connected_at=now(),updated_at=now() FROM channel WHERE users.id=$1 RETURNING users.id`,
      [
        user.id,
        workspaceId,
        encryptSlackToken(access.access_token, workspaceId),
        dm.channel.id,
        memberId,
      ],
    );
    return finish(saved.length ? 'connected' : 'reminders-active');
  } catch (error) {
    // Upstream fetch errors can contain credentials; never forward or log them.
    const status = (error as { statusCode?: number }).statusCode;
    return finish(
      status === 401 ? 'login-required' : status === 409 ? 'reminders-active' : 'failed',
    );
  }
});
