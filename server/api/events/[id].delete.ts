import { requireUser } from '#server/utils/auth'
import { query } from '#server/utils/db'
import { inputId } from '#server/utils/input'
import { cancelReminder } from '#server/services/reminders'
export default defineEventHandler(async event => {
 const user = await requireUser(event)
 const id = inputId(getRouterParam(event,'id'))
 const reminders = await query<{id:string}>('SELECT r.id FROM reminders r JOIN events e ON e.id=r.event_id JOIN projects p ON p.id=e.project_id WHERE e.id=$1 AND p.user_id=$2',[id,user.id])
 for (const reminder of reminders) await cancelReminder(reminder.id,user.id)
 const rows = await query('DELETE FROM events e USING projects p WHERE e.project_id=p.id AND e.id=$1 AND p.user_id=$2 RETURNING e.id',[id,user.id])
 if (!rows[0]) throw createError({statusCode:404,statusMessage:'Event not found'})
 return {ok:true}
})
