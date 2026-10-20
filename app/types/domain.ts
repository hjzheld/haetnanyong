export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type ReminderStatus = 'SCHEDULED' | 'FAILED' | 'UNKNOWN' | 'CANCEL_FAILED' | 'CANCELLED'

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  archivedAt: string | null
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string | null
  startDate: string | null
  dueDate: string | null
  priority: number
  status: TaskStatus
  completedAt: string | null
}

export interface CalendarItem {
  id: string
  kind: 'task' | 'event'
  projectId: string
  title: string
  startsAt: string | null
  endsAt: string | null
  startDate: string | null
  endDateExclusive: string | null
  allDay: boolean
  color: string
}
