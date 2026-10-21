export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type ReminderStatus =
  | 'PENDING'
  | 'SCHEDULING'
  | 'SCHEDULED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'CANCEL_PENDING'
  | 'CANCELED'
  | 'CANCEL_FAILED'
  | 'ELAPSED';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  archivedAt: string | null;
}

export interface Task {
  id: string;
  projectId: string | null;
  color: string;
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: TaskStatus;
  completedAt: string | null;
}

export interface CalendarItem {
  id: string;
  kind: 'task' | 'event';
  projectId: string | null;
  color: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  allDay: boolean;
}
