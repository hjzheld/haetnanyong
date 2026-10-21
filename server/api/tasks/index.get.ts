import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const scope = getQuery(event).scope;
  if (scope !== undefined && scope !== 'standalone')
    throw createError({ statusCode: 400, statusMessage: 'Invalid scope' });
  return query(
    'SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.start_date AS "startDate", t.due_date AS "dueDate", t.priority, t.color, t.status, t.completed_at AS "completedAt" FROM tasks t WHERE t.user_id = $1 AND (NOT $2::boolean OR t.project_id IS NULL) ORDER BY t.due_date, t.created_at DESC',
    [user.id, scope === 'standalone'],
  );
});
