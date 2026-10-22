import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputId } from '#server/utils/input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = inputId(getRouterParam(event, 'id'));
  const [item] = await query(
    'SELECT e.id, e.project_id AS "projectId", p.name AS "projectName", e.title, e.description, COALESCE(p.color,e.color) AS color, e.is_all_day AS "allDay", e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate" FROM events e LEFT JOIN projects p ON p.id=e.project_id AND p.user_id=e.user_id WHERE e.id=$1 AND e.user_id=$2',
    [id, user.id],
  );
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  return item;
});
