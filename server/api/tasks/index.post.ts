import { inputBody, inputId, inputText, inputDate, inputEnum, inputDescription } from '#server/utils/input'
import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = inputBody(await readBody(event))
  body.projectId = inputId(body.projectId)
  body.title = inputText(body.title, 'title')
  body.startDate = inputDate(body.startDate, 'startDate')
  body.dueDate = inputDate(body.dueDate, 'dueDate')
  if (body.startDate > body.dueDate) throw createError({ statusCode: 400, statusMessage: 'startDate must not exceed dueDate' })
  if (body.priority !== undefined) inputEnum(body.priority, ['LOW', 'MEDIUM', 'HIGH'], 'priority')
  if (body.description !== undefined) inputDescription(body.description)
  const rows = await query('INSERT INTO tasks (project_id, title, description, start_date, due_date, priority) SELECT id, $2, $3, $4, $5, $6 FROM projects WHERE id = $1 AND user_id = $7 AND archived_at IS NULL RETURNING id, project_id AS "projectId", title, description, start_date AS "startDate", due_date AS "dueDate", priority, status, completed_at AS "completedAt"', [body.projectId, body.title.trim(), body.description || null, body.startDate, body.dueDate, body.priority || 'MEDIUM', user.id])
  if (!rows[0]) throw createError({ statusCode: 400, statusMessage: 'Project not found or archived' })
  return rows[0]
})
