import { inputId } from '#server/utils/input';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { validateProjectInput } from '#server/utils/project-input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = inputId(getRouterParam(event, 'id'));
  const body = validateProjectInput(await readBody<unknown>(event));
  const color = body.color?.trim() || null;
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color))
    throw createError({
      statusCode: 400,
      statusMessage: 'Color must be a 6-digit hex value such as #557558',
    });
  const rows = await query(
    `UPDATE projects p SET name = COALESCE($1, p.name), description = COALESCE($2, p.description), color = COALESCE($3, p.color), archived_at = CASE WHEN $4::boolean IS NULL THEN p.archived_at WHEN $4 THEN now() ELSE NULL END, updated_at = now()
     WHERE p.id = $5 AND p.user_id = $6
       AND (NOT $7::boolean OR (
         p.archived_at IS NULL
         AND (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.user_id=$6)
           OR EXISTS (SELECT 1 FROM events e WHERE e.project_id=p.id AND e.user_id=$6))
         AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.user_id=$6 AND t.status <> 'DONE')
         AND NOT EXISTS (SELECT 1 FROM events e WHERE e.project_id=p.id AND e.user_id=$6
           AND CASE WHEN e.is_all_day THEN e.end_date::timestamp AT TIME ZONE 'Asia/Seoul' ELSE e.ends_at END > now())
       ))
     RETURNING p.id, p.name, p.description, p.color, p.archived_at AS "archivedAt"`,
    [
      body.name?.trim() || null,
      body.description ?? null,
      color,
      body.archived ?? null,
      id,
      user.id,
      body.onlyIfComplete === true,
    ],
  );
  if (!rows[0]) {
    if (body.onlyIfComplete) {
      const owned = await query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [
        id,
        user.id,
      ]);
      if (owned[0])
        throw createError({
          statusCode: 409,
          statusMessage:
            '프로젝트 상태가 변경되었어요. 모든 일정과 할 일의 완료 여부를 다시 확인해주세요.',
        });
    }
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }
  return rows[0];
});
