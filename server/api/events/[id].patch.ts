import {
  inputBody,
  inputId,
  inputText,
  inputDate,
  inputTime,
  inputDescription,
  inputColor,
} from '#server/utils/input';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = inputId(getRouterParam(event, 'id'));
  const body = inputBody(await readBody(event));
  if (
    !['title', 'description', 'startsAt', 'endsAt', 'startDate', 'endDate', 'color'].some(
      (key) => body[key] !== undefined,
    )
  )
    throw createError({ statusCode: 400, statusMessage: 'At least one event field is required' });
  if (body.title !== undefined) body.title = inputText(body.title, 'title');
  for (const key of ['startsAt', 'endsAt']) if (body[key] !== undefined) inputTime(body[key], key);
  for (const key of ['startDate', 'endDate'])
    if (body[key] !== undefined) inputDate(body[key], key);
  if (body.description !== undefined) inputDescription(body.description);
  if (body.color !== undefined) body.color = inputColor(body.color);
  if (body.title !== undefined && !body.title.trim())
    throw createError({ statusCode: 400, statusMessage: 'Title cannot be empty' });
  const active = await query(
    "SELECT r.id FROM reminders r JOIN events e ON e.id=r.event_id WHERE e.id=$1 AND e.user_id=$2 AND r.status NOT IN ('CANCELED','FAILED','ELAPSED')",
    [id, user.id],
  );
  if (active[0])
    throw createError({
      statusCode: 409,
      statusMessage: 'Cancel or reconcile the reminder before editing this event',
    });
  const rows = await query(
    'UPDATE events e SET title = COALESCE($1, e.title), description = CASE WHEN $9::boolean THEN $2::text ELSE e.description END, starts_at = COALESCE($3::timestamptz, e.starts_at), ends_at = COALESCE($4::timestamptz, e.ends_at), start_date = COALESCE($5::date, e.start_date), end_date = COALESCE($6::date, e.end_date), version = e.version + 1, color = COALESCE($10::varchar, e.color), updated_at = now() WHERE e.id = $7 AND e.user_id = $8 RETURNING e.id, e.project_id AS "projectId", e.title, e.description, e.color, e.is_all_day AS "allDay", e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate", e.end_date AS "endDate"',
    [
      body.title?.trim() || null,
      body.description ?? null,
      body.startsAt || null,
      body.endsAt || null,
      body.startDate || null,
      body.endDate || null,
      id,
      user.id,
      body.description !== undefined,
      body.color ?? null,
    ],
  );
  if (!rows[0])
    throw createError({ statusCode: 404, statusMessage: 'Event not found or invalid date range' });
  return rows[0];
});
