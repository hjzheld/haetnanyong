import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return query('SELECT e.id, e.project_id AS "projectId", e.title, e.description, e.is_all_day AS "allDay", e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate" FROM events e JOIN projects p ON p.id = e.project_id WHERE p.user_id = $1 ORDER BY COALESCE(e.starts_at, e.start_date::timestamptz)', [user.id])
})
