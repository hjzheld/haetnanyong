import tasksHandler from './tasks/index.get';
import eventsHandler from './events/index.get';
import { requireUser } from '#server/utils/auth';

export default defineEventHandler(async (event) => {
  await requireUser(event);
  if (getQuery(event).scope !== 'standalone') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid scope' });
  }
  const [tasks, events] = await Promise.all([tasksHandler(event), eventsHandler(event)]);
  return { tasks, events };
});
