import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { callSlack, slackTokenForChannel } from '#server/services/slack';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
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
  const member = await callSlack<{
    ok: boolean;
    user?: { id: string; team_id: string; deleted?: boolean; is_bot?: boolean };
  }>('users.info', { user: user.memberId }, token);
  if (
    !member.user ||
    member.user.id !== user.memberId ||
    member.user.team_id !== user.workspaceId ||
    member.user.deleted ||
    member.user.is_bot
  )
    throw createError({
      statusCode: 409,
      statusMessage: 'Slack recipient does not match the connected account',
      data: { slackCode: 'recipient_mismatch' },
    });
  // Exercise the reservation API with the SAME token and DM used for sending.
  // This reads only: it does not send or schedule a test message.
  const reservations = await callSlack<{ ok: boolean; scheduled_messages?: unknown[] }>(
    'chat.scheduledMessages.list',
    { channel: account.channel, limit: 1 },
    token,
  );
  if (!Array.isArray(reservations.scheduled_messages))
    throw createError({ statusCode: 502, statusMessage: 'Slack reservation list is incomplete' });
  return {
    ok: true,
    service: 'slack',
    connected: true,
    checks: { workspace: true, recipient: true, reservationList: true },
  };
});
