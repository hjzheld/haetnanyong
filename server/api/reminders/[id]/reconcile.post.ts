import { requireUser } from '#server/utils/auth';
import { inputId } from '#server/utils/input';
import { reconcileReminder } from '#server/services/reminders';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  try {
    const result = await reconcileReminder(inputId(getRouterParam(event, 'id')), user.id);
    return { id: result.id, status: result.status, revision: result.revision };
  } catch (error) {
    const retryAfter = (error as { data?: { retryAfter?: number } }).data?.retryAfter;
    if (retryAfter) setResponseHeader(event, 'Retry-After', retryAfter);
    throw error;
  }
});
