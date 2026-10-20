import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return query('SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.start_date AS "startDate", t.due_date AS "dueDate", t.priority, t.status, t.completed_at AS "completedAt" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.user_id = $1 ORDER BY t.due_date, t.created_at DESC', [user.id])
})
