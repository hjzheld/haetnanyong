import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const [tasks, events, completion] = await Promise.all([
    query(
      `SELECT t.id, t.title, t.due_date AS "dueDate", t.project_id AS "projectId", COALESCE(p.color,t.color) AS color FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.user_id=$1 AND p.archived_at IS NULL AND t.status <> 'DONE' AND t.due_date <= (now() AT TIME ZONE 'Asia/Seoul')::date + 3 ORDER BY t.due_date`,
      [user.id],
    ),
    query(
      `SELECT e.id, e.title, e.project_id AS "projectId", COALESCE(p.color,e.color) AS color, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate", e.is_all_day AS "allDay" FROM events e LEFT JOIN projects p ON p.id=e.project_id WHERE e.user_id=$1 AND p.archived_at IS NULL AND ((e.is_all_day=false AND e.starts_at < (((now() AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul') AND e.ends_at > (((now() AT TIME ZONE 'Asia/Seoul')::date)::timestamp AT TIME ZONE 'Asia/Seoul')) OR (e.is_all_day=true AND e.start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date AND e.end_date > (now() AT TIME ZONE 'Asia/Seoul')::date))`,
      [user.id],
    ),
    query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='DONE')::int AS completed FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.user_id=$1 AND p.archived_at IS NULL`,
      [user.id],
    ),
  ]);
  const stats = (completion[0] as { total: number; completed: number } | undefined) || {
    total: 0,
    completed: 0,
  };
  return {
    todayEvents: events,
    upcomingTasks: tasks,
    completion: {
      total: stats.total,
      completed: stats.completed,
      rate: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
    },
  };
});
