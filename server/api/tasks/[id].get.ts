import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputId } from '#server/utils/input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = inputId(getRouterParam(event, 'id'));
  const [item] = await query(
    'SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.color, t.start_date AS "startDate", t.due_date AS "dueDate", t.priority, t.status FROM tasks t WHERE t.id=$1 AND t.user_id=$2',
    [id, user.id],
  );
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Task not found' });
  return item;
});
