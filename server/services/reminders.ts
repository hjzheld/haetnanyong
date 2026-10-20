import { query } from '#server/utils/db'
import { cancelSlackMessage } from '#server/services/slack'

export async function cancelReminder(id: string, userId: string) {
  const [row] = await query<{ status: string; channel: string | null; message: string | null }>('SELECT r.status,r.slack_dm_channel_id AS channel,r.slack_scheduled_message_id AS message FROM reminders r JOIN events e ON e.id=r.event_id JOIN projects p ON p.id=e.project_id WHERE r.id=$1 AND p.user_id=$2', [id,userId])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })
  if (row.status === 'CANCELED') return
  if (['SCHEDULING','UNKNOWN','CANCEL_PENDING'].includes(row.status)) throw createError({ statusCode: 409, statusMessage: 'Reservation outcome requires reconciliation before cancellation' })
  const claimed = await query("UPDATE reminders SET status='CANCEL_PENDING',updated_at=now() WHERE id=$1 AND status=$2 RETURNING id", [id,row.status])
  if (!claimed[0]) throw createError({ statusCode: 409, statusMessage: 'Reminder state changed; reload before retrying' })
  try {
    if (row.message) {
      if (!row.channel) throw createError({ statusCode: 409, statusMessage: 'Stored Slack channel is missing' })
      await cancelSlackMessage(row.channel,row.message)
    }
    await query("UPDATE reminders SET status='CANCELED',canceled_at=now(),updated_at=now() WHERE id=$1", [id])
  } catch (error) {
    await query("UPDATE reminders SET status='CANCEL_FAILED',last_error_message=$1,updated_at=now() WHERE id=$2", [error instanceof Error ? error.message : 'Cancellation failed',id])
    throw error
  }
}
