import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return query('SELECT id, name, description, color, archived_at AS "archivedAt" FROM projects WHERE user_id = $1 ORDER BY archived_at NULLS FIRST, created_at DESC', [user.id])
})
