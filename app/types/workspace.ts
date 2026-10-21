export interface User {
  id: string;
  email: string;
  nickname: string;
}
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
  title: string;
  description: string | null;
  color: string;
  startDate: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
}
export interface ScheduleEvent {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  color: string;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
}
export interface Reminder {
  id: string;
  eventId: string;
  remindAt: string;
  offsetMinutes: number | null;
  status: string;
  errorMessage: string | null;
}
export interface CalendarItem {
  id: string;
  projectId: string | null;
  title: string;
  color: string;
  kind: 'task' | 'event';
  allDay?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  startDate: string | null;
  endDate: string | null;
}
