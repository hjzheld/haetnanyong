import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return query('SELECT r.id, r.event_id AS "eventId", r.timing_type AS "timingType", r.offset_minutes AS "offsetMinutes", r.remind_at AS "remindAt", r.slack_scheduled_message_id AS "slackScheduledMessageId", r.status, r.revision, r.last_error_message AS "errorMessage" FROM reminders r JOIN events e ON e.id = r.event_id JOIN projects p ON p.id = e.project_id WHERE p.user_id = $1 ORDER BY r.remind_at', [user.id])
})
