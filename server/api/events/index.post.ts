import { inputBody, inputId, inputText, inputDate, inputTime, inputDescription } from '#server/utils/input'
import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = inputBody(await readBody(event))
  body.projectId = inputId(body.projectId)
  body.title = inputText(body.title, 'title')
  if (body.allDay !== undefined && typeof body.allDay !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'allDay must be boolean' })
  if (body.description !== undefined) inputDescription(body.description)
  const allDay = body.allDay === true
  if (allDay && (!body.startDate || !body.endDate)) throw createError({ statusCode: 400, statusMessage: 'All-day events require startDate and endDate' })
  if (!allDay && (!body.startsAt || !body.endsAt)) throw createError({ statusCode: 400, statusMessage: 'Timed events require startsAt and endsAt' })
  const start = allDay ? inputDate(body.startDate, 'startDate') : inputTime(body.startsAt, 'startsAt')
  const end = allDay ? inputDate(body.endDate, 'endDate') : inputTime(body.endsAt, 'endsAt')
  if (Date.parse(start) >= Date.parse(end)) throw createError({ statusCode: 400, statusMessage: 'Event end must follow start' })
  const rows = await query('INSERT INTO events (project_id, title, description, is_all_day, starts_at, ends_at, start_date, end_date) SELECT id, $2, $3, $4, $5, $6, $7, $8 FROM projects WHERE id = $1 AND user_id = $9 AND archived_at IS NULL RETURNING id, project_id AS "projectId", title, description, is_all_day AS "allDay", starts_at AS "startsAt", ends_at AS "endsAt", start_date AS "startDate", end_date AS "endDate"', [body.projectId, body.title.trim(), body.description || null, allDay, allDay ? null : body.startsAt, allDay ? null : body.endsAt, allDay ? body.startDate : null, allDay ? body.endDate : null, user.id])
  if (!rows[0]) throw createError({ statusCode: 400, statusMessage: 'Project not found or archived' })
  return rows[0]
})
