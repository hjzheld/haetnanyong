import { inputId } from '#server/utils/input';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = inputId(getRouterParam(event, 'id'));
  const rows = await query(
    'UPDATE projects SET archived_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, user.id],
  );
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  return { ok: true };
});
