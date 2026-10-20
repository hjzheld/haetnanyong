import { inputBody, inputId, inputText, inputDate, inputEnum, inputDescription } from '#server/utils/input'
import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = inputId(getRouterParam(event, 'id'))
  const body = inputBody(await readBody(event))
  if (!['title','description','startDate','dueDate','priority','status'].some(key => body[key] !== undefined)) throw createError({ statusCode: 400, statusMessage: 'At least one task field is required' })
  if (body.title !== undefined) body.title = inputText(body.title, 'title')
  if (body.startDate !== undefined) inputDate(body.startDate, 'startDate')
  if (body.dueDate !== undefined) inputDate(body.dueDate, 'dueDate')
  if (body.priority !== undefined) inputEnum(body.priority, ['LOW', 'MEDIUM', 'HIGH'], 'priority')
  if (body.description !== undefined) inputDescription(body.description)
  if (body.title !== undefined && !body.title.trim()) throw createError({ statusCode: 400, statusMessage: 'Title cannot be empty' })
  if (body.status !== undefined) inputEnum(body.status, ['TODO', 'IN_PROGRESS', 'DONE'], 'status')
  const rows = await query('UPDATE tasks t SET title = COALESCE($1, t.title), description = CASE WHEN $9::boolean THEN $2::text ELSE t.description END, start_date = COALESCE($3::date, t.start_date), due_date = COALESCE($4::date, t.due_date), priority = COALESCE($5, t.priority), status = COALESCE($6, t.status), completed_at = CASE WHEN $6 = \'DONE\' THEN COALESCE(t.completed_at, now()) WHEN $6 IS NOT NULL THEN NULL ELSE t.completed_at END, updated_at = now() FROM projects p WHERE t.project_id = p.id AND t.id = $7 AND p.user_id = $8 RETURNING t.id, t.project_id AS "projectId", t.title, t.description, t.start_date AS "startDate", t.due_date AS "dueDate", t.priority, t.status, t.completed_at AS "completedAt"', [body.title?.trim() || null, body.description ?? null, body.startDate || null, body.dueDate || null, body.priority ?? null, body.status || null, id, user.id, body.description !== undefined])
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Task not found or invalid date range' })
  return rows[0]
})
