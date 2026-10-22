import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { verifyPassword } from '#server/utils/password';
import { cancelSlackMessage } from '#server/services/slack';
import { inputBody, inputPassword } from '#server/utils/input';

interface ReminderCancellation {
  channelId: string;
  scheduledMessageId: string;
  remindAt: string;
}

function slackErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/failed:\s*([a-z0-9_]+)/i)?.[1] || 'unknown_error';
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = inputBody(await readBody(event));
  const password = inputPassword(body.password);

  const [account] = await query<{ passwordHash: string }>(
    'SELECT password_hash AS "passwordHash" FROM users WHERE id=$1',
    [user.id],
  );
  if (!account || !(await verifyPassword(password, account.passwordHash)))
    throw createError({ statusCode: 400, statusMessage: '현재 비밀번호가 일치하지 않아요.' });

  // Losing an unknown reservation ID on deletion would make later cancellation impossible.
  const unresolved = await query(
    `SELECT r.id FROM reminders r JOIN events e ON e.id=r.event_id
      WHERE e.user_id=$1 AND r.status IN ('SCHEDULING','UNKNOWN','CANCEL_PENDING')
        AND r.slack_scheduled_message_id IS NULL LIMIT 1`,
    [user.id],
  );
  if (unresolved.length)
    throw createError({
      statusCode: 409,
      statusMessage: '예약 중이거나 결과 확인이 필요한 알림을 먼저 취소·확인해주세요.',
    });

  const reminders = await query<ReminderCancellation>(
    `SELECT r.slack_dm_channel_id AS "channelId",
            r.slack_scheduled_message_id AS "scheduledMessageId",
            r.remind_at AS "remindAt"
       FROM reminders r
       JOIN events e ON e.id=r.event_id
      WHERE e.user_id=$1
        AND r.slack_dm_channel_id IS NOT NULL
        AND r.slack_scheduled_message_id IS NOT NULL
        AND r.status IN ('SCHEDULED','SCHEDULING','UNKNOWN','CANCEL_PENDING','CANCEL_FAILED')`,
    [user.id],
  );

  const pendingJobs: Array<Record<string, string>> = [];
  for (const reminder of reminders) {
    try {
      await cancelSlackMessage(reminder.channelId, reminder.scheduledMessageId);
    } catch (error) {
      const code = slackErrorCode(error);
      // Slack uses this code when a reservation is already deleted or has already posted.
      if (code === 'invalid_scheduled_message_id') continue;
      const remindAt = new Date(reminder.remindAt).getTime();
      const purgeAfter = new Date(Math.max(Date.now(), remindAt) + 24 * 60 * 60_000).toISOString();
      pendingJobs.push({
        channelId: reminder.channelId,
        scheduledMessageId: reminder.scheduledMessageId,
        purgeAfter,
        errorCode: code,
      });
    }
  }

  await query('SELECT delete_user_account($1, $2::jsonb)', [user.id, JSON.stringify(pendingJobs)]);
  deleteCookie(event, 'session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
  });

  return { ok: true, pendingSlackCancellations: pendingJobs.length };
});
