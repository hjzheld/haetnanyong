import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [tasks, events, completion] = await Promise.all([
    query('SELECT t.id, t.title, t.due_date AS "dueDate", t.project_id AS "projectId" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.user_id = $1 AND t.status <> \'DONE\' AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 ORDER BY t.due_date', [user.id]),
    query('SELECT e.id, e.title, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.is_all_day AS "allDay" FROM events e JOIN projects p ON p.id = e.project_id WHERE p.user_id = $1 AND ((e.is_all_day = false AND e.starts_at >= CURRENT_DATE AND e.starts_at < CURRENT_DATE + interval \'1 day\') OR (e.is_all_day = true AND e.start_date <= CURRENT_DATE AND e.end_date > CURRENT_DATE))', [user.id]),
    query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = \'DONE\')::int AS completed FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.user_id = $1', [user.id]),
  ])
  const stats = (completion[0] as { total: number; completed: number } | undefined) || { total: 0, completed: 0 }
  return { todayEvents: events, upcomingTasks: tasks, completion: { total: stats.total, completed: stats.completed, rate: stats.total ? Math.round(stats.completed / stats.total * 100) : 0 } }
})
