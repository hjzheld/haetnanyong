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
  const body = inputBody(await readBody(event));
  const projectId =
    body.projectId === undefined || body.projectId === null || body.projectId === ''
      ? null
      : inputId(body.projectId);
  body.title = inputText(body.title, 'title');
  if (body.allDay !== undefined && typeof body.allDay !== 'boolean')
    throw createError({ statusCode: 400, statusMessage: 'allDay must be boolean' });
  if (body.description !== undefined) inputDescription(body.description);
  const color = body.color === undefined ? '#8E8AA3' : inputColor(body.color);
  const allDay = body.allDay === true;
  if (allDay && (!body.startDate || !body.endDate))
    throw createError({
      statusCode: 400,
      statusMessage: 'All-day events require startDate and endDate',
    });
  if (!allDay && (!body.startsAt || !body.endsAt))
    throw createError({
      statusCode: 400,
      statusMessage: 'Timed events require startsAt and endsAt',
    });
  const start = allDay
    ? inputDate(body.startDate, 'startDate')
    : inputTime(body.startsAt, 'startsAt');
  const end = allDay ? inputDate(body.endDate, 'endDate') : inputTime(body.endsAt, 'endsAt');
  if (Date.parse(start) >= Date.parse(end))
    throw createError({ statusCode: 400, statusMessage: 'Event end must follow start' });
  const rows = await query(
    'INSERT INTO events (user_id, project_id, title, description, is_all_day, starts_at, ends_at, start_date, end_date, color) SELECT $1::bigint, p.id, $3::varchar, $4::text, $5::boolean, $6::timestamptz, $7::timestamptz, $8::date, $9::date, $10::varchar FROM projects p WHERE p.id = $2 AND p.user_id = $1 AND p.archived_at IS NULL UNION ALL SELECT $1::bigint, NULL::bigint, $3::varchar, $4::text, $5::boolean, $6::timestamptz, $7::timestamptz, $8, $9, $10 WHERE $2::bigint IS NULL RETURNING id, project_id AS "projectId", title, description, color, is_all_day AS "allDay", starts_at AS "startsAt", ends_at AS "endsAt", start_date AS "startDate", end_date AS "endDate"',
    [
      user.id,
      projectId,
      body.title.trim(),
      body.description || null,
      allDay,
      allDay ? null : body.startsAt,
      allDay ? null : body.endsAt,
      allDay ? body.startDate : null,
      allDay ? body.endDate : null,
      color,
    ],
  );
  if (!rows[0])
    throw createError({ statusCode: 400, statusMessage: 'Project not found or archived' });
  return rows[0];
});
