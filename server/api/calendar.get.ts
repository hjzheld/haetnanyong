import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputTime } from '#server/utils/input';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const from = getQuery(event).from || new Date().toISOString();
  const to = getQuery(event).to || new Date(Date.now() + 31 * 86400000).toISOString();
  inputTime(from, 'from');
  inputTime(to, 'to');
  if (Date.parse(String(from)) >= Date.parse(String(to)))
    throw createError({ statusCode: 400, statusMessage: 'from must precede to' });
  return query(
    `SELECT e.id, 'event' AS kind, e.project_id AS "projectId", COALESCE(p.color, e.color) AS color,
      e.title, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.start_date AS "startDate",
      e.end_date AS "endDate", e.is_all_day AS "allDay"
      FROM events e LEFT JOIN projects p ON p.id=e.project_id AND p.user_id=$1
      WHERE e.user_id=$1 AND p.archived_at IS NULL
        AND ((e.is_all_day=false AND e.starts_at<$3::timestamptz AND e.ends_at>$2::timestamptz)
          OR (e.is_all_day=true AND e.start_date<($3::timestamptz AT TIME ZONE 'Asia/Seoul')::date
            AND e.end_date>($2::timestamptz AT TIME ZONE 'Asia/Seoul')::date))`,
    [user.id, from, to],
  );
});
