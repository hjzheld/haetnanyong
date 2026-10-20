import { inputId } from '#server/utils/input'
import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'
import { validateProjectInput } from '#server/utils/project-input'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = inputId(getRouterParam(event, 'id'))
  const body = validateProjectInput(await readBody<unknown>(event))
  const color = body.color?.trim() || null
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) throw createError({ statusCode: 400, statusMessage: 'Color must be a 6-digit hex value such as #557558' })
  const rows = await query('UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color), archived_at = CASE WHEN $4::boolean IS NULL THEN archived_at WHEN $4 THEN now() ELSE NULL END, updated_at = now() WHERE id = $5 AND user_id = $6 RETURNING id, name, description, color, archived_at AS "archivedAt"', [body.name?.trim() || null, body.description ?? null, color, body.archived ?? null, id, user.id])
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return rows[0]
})
