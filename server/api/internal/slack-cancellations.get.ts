import { query } from '#server/utils/db';
import { cancelSlackMessage } from '#server/services/slack';
import { reconcileReminder } from '#server/services/reminders';

interface CancellationJob {
  id: string;
  channelId: string;
  scheduledMessageId: string;
}

function codeFrom(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/failed:\s*([a-z0-9_]+)/i)?.[1] || 'unknown_error';
}

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().cronSecret;
  if (!secret || getHeader(event, 'authorization') !== `Bearer ${secret}`)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized cron request' });

  await query('DELETE FROM slack_cancellation_jobs WHERE purge_after <= now()');
  await query('DELETE FROM api_rate_limits WHERE expires_at <= now()');
  await query('DELETE FROM slack_oauth_states WHERE expires_at <= now()');
  await query(`DELETE FROM slack_channel_installations c
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.slack_dm_channel_id=c.channel_id)
      AND NOT EXISTS (SELECT 1 FROM slack_cancellation_jobs j WHERE j.slack_dm_channel_id=c.channel_id)
      AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.slack_dm_channel_id=c.channel_id AND r.status NOT IN ('CANCELED','FAILED','ELAPSED'))`);
  await query(`DELETE FROM slack_installations i
    WHERE NOT EXISTS (SELECT 1 FROM slack_channel_installations c WHERE c.workspace_id=i.workspace_id)`);
  await query(
    "DELETE FROM email_verification_tokens WHERE expires_at <= now() OR used_at < now() - interval '24 hours'",
  );
  const jobs = await query<CancellationJob>(
    `SELECT id, slack_dm_channel_id AS "channelId",
            slack_scheduled_message_id AS "scheduledMessageId"
       FROM slack_cancellation_jobs
      WHERE next_attempt_at <= now() AND purge_after > now()
      ORDER BY next_attempt_at
      LIMIT 50`,
  );

  const deadline = Date.now() + 25_000;
  let processed = 0;
  let resolved = 0;
  for (const job of jobs) {
    // Each Slack call may take 15 seconds. Leave room before starting another.
    if (deadline - Date.now() < 15_000) break;
    processed++;
    try {
      await cancelSlackMessage(job.channelId, job.scheduledMessageId);
      await query('DELETE FROM slack_cancellation_jobs WHERE id=$1', [job.id]);
      resolved += 1;
    } catch (error) {
      const code = codeFrom(error);
      if (code === 'invalid_scheduled_message_id') {
        await query('DELETE FROM slack_cancellation_jobs WHERE id=$1', [job.id]);
        resolved += 1;
      } else {
        await query(
          `UPDATE slack_cancellation_jobs
              SET attempt_count=attempt_count+1,
                  next_attempt_at=now() + (LEAST(3600, 60 * power(2, LEAST(attempt_count, 5))) * interval '1 second'),
                  last_error_code=$1,
                  updated_at=now()
            WHERE id=$2`,
          [code, job.id],
        );
      }
    }
  }
  const reminders = await query<{ id: string; userId: string }>(
    `SELECT r.id,e.user_id AS "userId" FROM reminders r JOIN events e ON e.id=r.event_id
      WHERE r.status IN ('UNKNOWN','SCHEDULING','CANCEL_PENDING','SCHEDULED')
        AND r.updated_at < now() - interval '2 minutes'
      ORDER BY r.updated_at LIMIT 10`,
  );
  let reconciled = 0;
  for (const reminder of reminders) {
    if (deadline - Date.now() < 15_000) break;
    try {
      await reconcileReminder(reminder.id, reminder.userId, deadline);
      reconciled++;
    } catch {
      // Keep uncertain reservations intact; another run or the owner can retry.
    }
  }
  return { ok: true, processed, resolved, reconciled };
});
