import type { Task, ScheduleEvent } from '~/types/workspace';

export function isProjectComplete(tasks: Task[], events: ScheduleEvent[], now: number) {
  return (
    tasks.length + events.length > 0 &&
    tasks.every((task) => task.status === 'DONE') &&
    events.every((event) => {
      const end = event.allDay
        ? event.endDate && `${event.endDate.slice(0, 10)}T00:00:00+09:00`
        : event.endsAt;
      return !!end && Date.parse(end) <= now;
    })
  );
}
