import { requireUser } from '#server/utils/auth';
import { inputId } from '#server/utils/input';
import { cancelReminder } from '#server/services/reminders';
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await cancelReminder(inputId(getRouterParam(event, 'id')), user.id);
  return { ok: true };
});
