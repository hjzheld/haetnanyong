import type { CalendarItem, ScheduleEvent, Task } from '~/types/workspace';
import { datePart, koreaDate } from './display';

export function toCalendarItems(tasks: Task[], events: ScheduleEvent[]): CalendarItem[] {
  return [
    ...tasks.map((task) => ({ ...task, kind: 'task' as const, endDate: task.dueDate })),
    ...events.map((event) => ({ ...event, kind: 'event' as const })),
  ];
}

export function occursOnDay(item: CalendarItem, day: string): boolean {
  if (item.kind === 'task')
    return datePart(item.startDate || item.endDate) <= day && datePart(item.endDate) >= day;
  if (item.allDay) return datePart(item.startDate) <= day && datePart(item.endDate) > day;
  if (!item.startsAt || !item.endsAt) return false;
  return (
    koreaDate(new Date(item.startsAt)) <= day &&
    koreaDate(new Date(Date.parse(item.endsAt) - 1)) >= day
  );
}

// Convert timestamps once per item, rather than again for every calendar cell
// and unrelated UI update (menu, toast, dialog, etc.).
export function groupCalendarItems(items: CalendarItem[], days: string[]) {
  const groups = new Map<string, CalendarItem[]>();
  for (const day of days) if (day) groups.set(day, []);
  for (const item of items) {
    if (item.kind === 'task') {
      const start = datePart(item.startDate || item.endDate);
      const end = datePart(item.endDate);
      for (const [day, entries] of groups) {
        if (day >= start && day <= end) entries.push(item);
      }
      continue;
    }
    if (!item.allDay && (!item.startsAt || !item.endsAt)) continue;
    const start = item.allDay ? datePart(item.startDate) : koreaDate(new Date(item.startsAt!));
    const end = item.allDay
      ? datePart(item.endDate)
      : koreaDate(new Date(Date.parse(item.endsAt!) - 1));
    for (const [day, entries] of groups) {
      if (day >= start && (item.allDay ? day < end : day <= end)) entries.push(item);
    }
  }
  return groups;
}
