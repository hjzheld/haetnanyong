import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'
import { inputTime } from '#server/utils/input'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const from = getQuery(event).from || new Date().toISOString()
  const to = getQuery(event).to || new Date(Date.now() + 31 * 86400000).toISOString()
  inputTime(from, 'from')
  inputTime(to, 'to')
  if (Date.parse(String(from)) >= Date.parse(String(to))) throw createError({ statusCode: 400, statusMessage: 'from must precede to' })
  const [tasks, events] = await Promise.all([
    query('SELECT t.id, \'task\' AS kind, t.project_id AS "projectId", t.title, t.start_date AS "startDate", t.due_date AS "endDate" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.user_id = $1 AND t.due_date >= $2::date AND t.start_date <= $3::date', [user.id, from, to]),
    query('SELECT e.id, \'event\' AS kind, e.project_id AS "projectId", e.title, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate", e.is_all_day AS "allDay" FROM events e JOIN projects p ON p.id = e.project_id WHERE p.user_id = $1 AND ((e.is_all_day = false AND e.starts_at < $3::timestamptz AND e.ends_at > $2::timestamptz) OR (e.is_all_day = true AND e.start_date < $3::date AND e.end_date > $2::date))', [user.id, from, to]),
  ])
  return [...tasks, ...events]
})
