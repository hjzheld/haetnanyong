import {
  inputBody,
  inputId,
  inputText,
  inputDate,
  inputEnum,
  inputDescription,
  inputColor,
} from '#server/utils/input';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = inputBody(await readBody(event));
  const projectId =
    body.projectId === undefined || body.projectId === null || body.projectId === ''
      ? null
      : inputId(body.projectId);
  body.title = inputText(body.title, 'title');
  body.startDate = inputDate(body.startDate, 'startDate');
  body.dueDate = inputDate(body.dueDate, 'dueDate');
  if (body.startDate > body.dueDate)
    throw createError({ statusCode: 400, statusMessage: 'startDate must not exceed dueDate' });
  if (body.priority !== undefined) inputEnum(body.priority, ['LOW', 'MEDIUM', 'HIGH'], 'priority');
  if (body.description !== undefined) inputDescription(body.description);
  const color = body.color === undefined ? '#C98B8B' : inputColor(body.color);
  const rows = await query(
    'INSERT INTO tasks (user_id, project_id, title, description, start_date, due_date, priority, color) SELECT $1::bigint, p.id, $3::varchar, $4::text, $5::date, $6::date, $7::varchar, $8::varchar FROM projects p WHERE p.id = $2 AND p.user_id = $1 AND p.archived_at IS NULL UNION ALL SELECT $1::bigint, NULL::bigint, $3::varchar, $4::text, $5::date, $6::date, $7::varchar, $8 WHERE $2::bigint IS NULL RETURNING id, project_id AS "projectId", title, description, start_date AS "startDate", due_date AS "dueDate", priority, color, status, completed_at AS "completedAt"',
    [
      user.id,
      projectId,
      body.title.trim(),
      body.description || null,
      body.startDate,
      body.dueDate,
      body.priority || 'MEDIUM',
      color,
    ],
  );
  if (!rows[0])
    throw createError({ statusCode: 400, statusMessage: 'Project not found or archived' });
  return rows[0];
});
