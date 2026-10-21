import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { scheduleSlackMessage } from '#server/services/slack';
import { inputBody, inputId, inputText, inputTime } from '#server/utils/input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = inputBody(await readBody(event));
  const eventId = inputId(body.eventId);
  const text = inputText(body.text, 'text');
  const [item] = await query<{
    starts_at: string | null;
    is_all_day: boolean;
    channel: string | null;
  }>(
    'SELECT e.starts_at, e.is_all_day, u.slack_dm_channel_id AS channel FROM events e JOIN users u ON u.id = e.user_id LEFT JOIN projects p ON p.id = e.project_id WHERE e.id = $1 AND e.user_id = $2 AND p.archived_at IS NULL',
    [eventId, user.id],
  );
  if (!item)
    throw createError({ statusCode: 404, statusMessage: 'Event not found or project archived' });
  const custom = body.scheduledAt !== undefined;
  const offset = body.offsetMinutes ?? 10;
  if (custom && body.offsetMinutes !== undefined)
    throw createError({
      statusCode: 400,
      statusMessage: 'Use scheduledAt or offsetMinutes, not both',
    });
  if (!custom && (item.is_all_day || ![10, 30].includes(offset)))
    throw createError({
      statusCode: 400,
      statusMessage:
        'Timed events require offsetMinutes 10 or 30; all-day events require scheduledAt',
    });
  const when = custom
    ? new Date(inputTime(body.scheduledAt, 'scheduledAt'))
    : new Date(Date.parse(item.starts_at!) - offset * 60000);
  if (
    !Number.isFinite(when.getTime()) ||
    when.getTime() <= Date.now() ||
    when.getTime() > Date.now() + 120 * 86400000
  )
    throw createError({
      statusCode: 400,
      statusMessage: 'Reminder must be in the future and within 120 days',
    });
  const channel = item.channel;
  if (!channel)
    throw createError({
      statusCode: 409,
      statusMessage: '마이페이지에서 본인의 Slack 계정을 먼저 연결해주세요.',
    });
  const key = eventId + ':' + when.toISOString();
  const [pending] = await query<{ id: string }>(
    "INSERT INTO reminders (event_id,timing_type,offset_minutes,remind_at,status,idempotency_key,slack_dm_channel_id) VALUES ($1,$2,$3,$4,'SCHEDULING',$5,$6) ON CONFLICT (event_id) DO UPDATE SET timing_type=EXCLUDED.timing_type, offset_minutes=EXCLUDED.offset_minutes, remind_at=EXCLUDED.remind_at, status='SCHEDULING', idempotency_key=EXCLUDED.idempotency_key, slack_dm_channel_id=EXCLUDED.slack_dm_channel_id, slack_scheduled_message_id=NULL, reservation_accepted_at=NULL, canceled_at=NULL, revision=reminders.revision+1, updated_at=now() WHERE reminders.status='CANCELED' RETURNING id",
    [
      eventId,
      custom ? 'CUSTOM' : 'BEFORE_START',
      custom ? null : offset,
      when.toISOString(),
      key,
      channel,
    ],
  );
  if (!pending)
    throw createError({
      statusCode: 409,
      statusMessage: 'Event already has a reminder; cancel it before replacing it',
    });
  try {
    const slack = await scheduleSlackMessage(channel, text, Math.floor(when.getTime() / 1000));
    if (!slack.scheduled_message_id)
      throw createError({
        statusCode: 502,
        statusMessage: 'Slack did not return a reservation ID',
      });
    const [result] = await query(
      'UPDATE reminders SET status=\'SCHEDULED\', slack_scheduled_message_id=$1, reservation_accepted_at=now(), attempt_count=attempt_count+1, last_attempt_at=now(), last_error_message=NULL, updated_at=now() WHERE id=$2 RETURNING id,event_id AS "eventId",remind_at AS "remindAt",status,revision',
      [slack.scheduled_message_id, pending.id],
    );
    return result;
  } catch (error) {
    await query(
      "UPDATE reminders SET status='UNKNOWN', attempt_count=attempt_count+1, last_attempt_at=now(), last_error_message=$1, updated_at=now() WHERE id=$2",
      [error instanceof Error ? error.message : 'Scheduling outcome unknown', pending.id],
    );
    throw error;
  }
});
