import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const scope = getQuery(event).scope;
  if (scope !== undefined && scope !== 'standalone')
    throw createError({ statusCode: 400, statusMessage: 'Invalid scope' });
  return query(
    'SELECT e.id, e.project_id AS "projectId", e.title, e.description, e.color, e.is_all_day AS "allDay", e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate" FROM events e WHERE e.user_id = $1 AND (NOT $2::boolean OR e.project_id IS NULL) ORDER BY COALESCE(e.starts_at, e.start_date::timestamptz)',
    [user.id, scope === 'standalone'],
  );
});
