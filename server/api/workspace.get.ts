import projectsHandler from './projects/index.get';
import tasksHandler from './tasks/index.get';
import eventsHandler from './events/index.get';
import remindersHandler from './reminders/index.get';

// Reuse the existing ownership filters and response shapes. Authentication is
// shared only within this request, never between users or subsequent requests.
export default defineEventHandler(async (event) => {
  const [projects, tasks, events, reminders] = await Promise.all([
    projectsHandler(event),
    tasksHandler(event),
    eventsHandler(event),
    remindersHandler(event),
  ]);
  return { projects, tasks, events, reminders };
});
