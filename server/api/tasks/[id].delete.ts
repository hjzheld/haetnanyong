import { inputId } from '#server/utils/input'
import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = inputId(getRouterParam(event, 'id'))
  const rows = await query('DELETE FROM tasks t USING projects p WHERE t.project_id = p.id AND t.id = $1 AND p.user_id = $2 RETURNING t.id', [id, user.id])
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  return { ok: true }
})
