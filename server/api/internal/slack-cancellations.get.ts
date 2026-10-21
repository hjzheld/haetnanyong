import { query } from '#server/utils/db';
import { cancelSlackMessage } from '#server/services/slack';

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

  let resolved = 0;
  for (const job of jobs) {
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
  return { ok: true, processed: jobs.length, resolved };
});
