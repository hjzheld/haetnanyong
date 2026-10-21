import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { callSlack, slackTokenForChannel } from '#server/services/slack';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, true);
  const [account] = await query<{ channel: string | null }>(
    'SELECT slack_dm_channel_id AS channel FROM users WHERE id=$1',
    [user.id],
  );
  if (!user.connectedAt || !account?.channel)
    throw createError({
      statusCode: 409,
      statusMessage: '마이페이지에서 본인의 Slack 계정을 먼저 연결해주세요.',
    });
  const token = await slackTokenForChannel(account.channel);
  const result = await callSlack<{ ok: boolean; team_id?: string }>('auth.test', {}, token);
  if (result.team_id !== user.workspaceId)
    throw createError({
      statusCode: 409,
      statusMessage: 'Slack workspace does not match the connected account',
    });
  return { ok: true, service: 'slack', connected: true };
});
