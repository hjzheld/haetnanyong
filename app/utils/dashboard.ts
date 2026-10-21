import type { Task } from '~/types/workspace';
import { datePart } from './display';

export function dashboardTasks(
  tasks: Task[],
  today: string,
  visible: (id: string | null) => boolean,
) {
  const end = new Date(`${today}T12:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 3);
  const limit = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(end);
  const pending = tasks
    .filter((t) => visible(t.projectId) && t.status !== 'DONE')
    .sort((a, b) => datePart(a.dueDate).localeCompare(datePart(b.dueDate)));
  return {
    overdue: pending.filter((t) => datePart(t.dueDate) < today),
    upcoming: pending.filter((t) => datePart(t.dueDate) >= today && datePart(t.dueDate) <= limit),
  };
}
