import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputId } from '#server/utils/input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const eventId = getQuery(event).eventId;
  const filterId = eventId === undefined ? null : inputId(eventId);
  return query(
    'SELECT r.id, r.event_id AS "eventId", r.timing_type AS "timingType", r.offset_minutes AS "offsetMinutes", r.remind_at AS "remindAt", r.slack_scheduled_message_id AS "slackScheduledMessageId", r.status, r.revision, r.last_error_message AS "errorMessage" FROM reminders r JOIN events e ON e.id = r.event_id WHERE e.user_id = $1 AND ($2::bigint IS NULL OR r.event_id = $2) ORDER BY r.remind_at',
    [user.id, filterId],
  );
});
