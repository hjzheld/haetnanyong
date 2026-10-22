import { createHash } from 'node:crypto';
import { query } from '#server/utils/db';
import {
  cancelSlackMessage,
  listScheduledSlackMessages,
  slackFailure,
  type ScheduledSlackMessage,
} from '#server/services/slack';

export function reminderKey(eventId: string, when: string, text: string) {
  return `${eventId}:${when}:${createHash('sha256').update(text).digest('hex').slice(0, 24)}`;
}

interface ReminderState {
  id: string;
  status: string;
  revision: number;
  channel: string | null;
  message: string | null;
  key: string;
  remindAt: string;
  updatedAt: string;
}

async function ownedReminder(id: string, userId: string) {
  const [row] = await query<ReminderState>(
    `SELECT r.id,r.status,r.revision,r.slack_dm_channel_id AS channel,
      r.slack_scheduled_message_id AS message,r.idempotency_key AS key,
      r.remind_at AS "remindAt",r.updated_at::text AS "updatedAt"
      FROM reminders r JOIN events e ON e.id=r.event_id WHERE r.id=$1 AND e.user_id=$2`,
    [id, userId],
  );
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Reminder not found' });
  return row;
}

export async function reconcileReminder(
  id: string,
  userId: string,
  deadline?: number,
  scheduledByChannel?: Map<string, ScheduledSlackMessage[]>,
) {
  const row = await ownedReminder(id, userId);
  if (!['SCHEDULING', 'UNKNOWN', 'SCHEDULED', 'CANCEL_PENDING'].includes(row.status)) return row;
  // Do not reconcile an HTTP request that may still be in flight.
  if (row.status !== 'SCHEDULED' && Date.now() - new Date(row.updatedAt).getTime() < 120_000)
    return row;
  if (!row.channel)
    throw createError({ statusCode: 409, statusMessage: 'Stored Slack channel is missing' });
  let messages = scheduledByChannel?.get(row.channel);
  if (!messages) {
    messages = await listScheduledSlackMessages(row.channel, deadline);
    scheduledByChannel?.set(row.channel, messages);
  }
  const at = Math.floor(new Date(row.remindAt).getTime() / 1000);
  const candidates = messages.filter(
    (m) => m.channel_id === row.channel && Number(m.post_at) === at,
  );
  const matches = row.message
    ? messages.filter((m) => m.channel_id === row.channel && m.id === row.message)
    : candidates.filter(
        (m) =>
          reminderKey(row.key.split(':')[0]!, new Date(row.remindAt).toISOString(), m.text) ===
          row.key,
      );
  // Old rows have no text fingerprint. Never claim somebody else's same-time message.
  if (matches.length > 1 || (!row.message && !matches.length && candidates.length)) return row;
  const match = matches[0];
  const status =
    row.status === 'CANCEL_PENDING'
      ? match
        ? 'CANCEL_FAILED'
        : 'CANCELED'
      : match
        ? 'SCHEDULED'
        : at <= Date.now() / 1000
          ? 'ELAPSED'
          : 'FAILED';
  const [updated] = await query<ReminderState>(
    `UPDATE reminders SET status=$1::varchar,
      slack_scheduled_message_id=COALESCE($2::varchar,slack_scheduled_message_id),
      reservation_accepted_at=CASE WHEN $2::varchar IS NOT NULL THEN COALESCE(reservation_accepted_at,now()) ELSE reservation_accepted_at END,
      canceled_at=CASE WHEN $1::varchar='CANCELED' THEN now() ELSE canceled_at END,
      last_error_code=CASE WHEN $1::varchar='ELAPSED' THEN COALESCE(last_error_code,'delivery_unverified') ELSE $3 END,
      last_error_message=CASE WHEN $1::varchar='ELAPSED' THEN COALESCE(last_error_message,'Scheduled time passed; delivery is unverified') ELSE $4 END,
      updated_at=now()
      WHERE id=$5 AND revision=$6 AND status=$7 AND updated_at=$8
      RETURNING id,status,revision`,
    [
      status,
      match?.id || null,
      status === 'FAILED' ? 'reservation_not_found' : null,
      status === 'FAILED' ? 'Slack reservation was not found; choose a new reminder time' : null,
      id,
      row.revision,
      row.status,
      row.updatedAt,
    ],
  );
  return updated || ownedReminder(id, userId);
}

// A past SCHEDULED row may already be shown as elapsed in the UI. Recheck it
// before blocking edits or Slack connection changes, while preserving uncertain
// outcomes and reservations that Slack still lists.
export async function hasActiveReminders(userId: string, eventId: string | null = null) {
  const active = await query<{ id: string; status: string; remindAt: string }>(
    `SELECT r.id,r.status,r.remind_at AS "remindAt"
      FROM reminders r JOIN events e ON e.id=r.event_id
      WHERE e.user_id=$1 AND ($2::bigint IS NULL OR e.id=$2)
        AND r.status NOT IN ('CANCELED','FAILED','ELAPSED')`,
    [userId, eventId],
  );
  if (!active.length) return false;
  // Existing future or uncertain reservations already require the user to act.
  if (active.some((row) => row.status !== 'SCHEDULED' || !(Date.parse(row.remindAt) <= Date.now())))
    return true;
  const deadline = Date.now() + 15_000;
  const scheduledByChannel = new Map<string, ScheduledSlackMessage[]>();
  for (const row of active) {
    if (Date.now() >= deadline) return true;
    await reconcileReminder(row.id, userId, deadline, scheduledByChannel);
  }
  const remaining = await query(
    `SELECT r.id FROM reminders r JOIN events e ON e.id=r.event_id
      WHERE e.user_id=$1 AND ($2::bigint IS NULL OR e.id=$2)
        AND r.status NOT IN ('CANCELED','FAILED','ELAPSED') LIMIT 1`,
    [userId, eventId],
  );
  return remaining.length > 0;
}

export async function cancelReminder(id: string, userId: string) {
  let row = await ownedReminder(id, userId);
  if (['SCHEDULING', 'UNKNOWN', 'CANCEL_PENDING'].includes(row.status)) {
    await reconcileReminder(id, userId);
    row = await ownedReminder(id, userId);
  }
  if (row.status === 'CANCELED') return;
  if (['SCHEDULING', 'UNKNOWN', 'CANCEL_PENDING'].includes(row.status))
    throw createError({
      statusCode: 409,
      statusMessage: 'Reservation outcome requires reconciliation before cancellation',
    });
  const claimed = await query(
    "UPDATE reminders SET status='CANCEL_PENDING',updated_at=now() WHERE id=$1 AND status=$2 AND revision=$3 AND updated_at=$4 RETURNING id",
    [id, row.status, row.revision, row.updatedAt],
  );
  if (!claimed[0])
    throw createError({
      statusCode: 409,
      statusMessage: 'Reminder state changed; reload before retrying',
    });
  try {
    if (row.message && !['FAILED', 'ELAPSED'].includes(row.status)) {
      if (!row.channel)
        throw createError({ statusCode: 409, statusMessage: 'Stored Slack channel is missing' });
      try {
        await cancelSlackMessage(row.channel, row.message);
      } catch (error) {
        if (slackFailure(error).code !== 'invalid_scheduled_message_id') throw error;
      }
    }
    await query(
      "UPDATE reminders SET status='CANCELED',canceled_at=now(),last_error_code=NULL,last_error_message=NULL,updated_at=now() WHERE id=$1 AND revision=$2 AND status='CANCEL_PENDING'",
      [id, row.revision],
    );
  } catch (error) {
    await query(
      "UPDATE reminders SET status='CANCEL_FAILED',last_error_code=$1,last_error_message=$2,updated_at=now() WHERE id=$3 AND revision=$4 AND status='CANCEL_PENDING'",
      [
        slackFailure(error).code,
        error instanceof Error ? error.message : 'Cancellation failed',
        id,
        row.revision,
      ],
    );
    throw error;
  }
}
