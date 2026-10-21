import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { callSlack, slackTokenForChannel } from '#server/services/slack';

// Only an explicit click sends this fixed test message to the signed-in user's DM.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const user = await requireUser(event, true);
  const [account] = await query<{ channel: string | null }>(
    'SELECT slack_dm_channel_id AS channel FROM users WHERE id=$1',
    [user.id],
  );
  if (!user.connectedAt || !user.memberId || !user.workspaceId || !account?.channel)
    throw createError({ statusCode: 409, statusMessage: 'Slack account is not connected' });
  const token = await slackTokenForChannel(account.channel);
  if (!token)
    throw createError({
      statusCode: 503,
      statusMessage: 'Slack installation token is unavailable',
    });
  const auth = await callSlack<{ ok: boolean; team_id?: string }>('auth.test', {}, token);
  if (auth.team_id !== user.workspaceId)
    throw createError({
      statusCode: 409,
      statusMessage: 'Slack workspace does not match the connected account',
    });
  const dm = await callSlack<{ ok: boolean; channel?: { id: string } }>(
    'conversations.open',
    { users: user.memberId },
    token,
  );
  if (dm.channel?.id !== account.channel)
    throw createError({
      statusCode: 409,
      statusMessage: 'Slack recipient does not match the connected account',
    });
  const result = await callSlack<{ ok: boolean; channel?: string; ts?: string }>(
    'chat.postMessage',
    {
      channel: account.channel,
      text: '🐾 했냐옹 · Slack DM 연결 테스트 / Slack DM connection test',
    },
    token,
  );
  if (!result.ts || result.channel !== account.channel)
    throw createError({
      statusCode: 502,
      statusMessage: 'Slack test message delivery could not be confirmed',
    });
  return { ok: true };
});
