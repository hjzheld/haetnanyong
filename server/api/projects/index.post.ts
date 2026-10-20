import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'
import { validateProjectInput } from '#server/utils/project-input'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = validateProjectInput(await readBody<unknown>(event), true)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'Project name is required' })
  const color = body.color?.trim() || '#557558'
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw createError({ statusCode: 400, statusMessage: 'Color must be a 6-digit hex value such as #557558' })
  const rows = await query('INSERT INTO projects (user_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING id, name, description, color', [user.id, body.name.trim(), body.description || null, color])
  return rows[0]
})
