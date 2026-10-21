import type { CalendarItem, ScheduleEvent } from '~/types/workspace';
import { datePart, koreaDate } from './display';

export function toCalendarItems(events: ScheduleEvent[]): CalendarItem[] {
  return events.map((event) => ({ ...event, kind: 'event' as const }));
}

export function occursOnDay(item: CalendarItem, day: string): boolean {
  if (item.kind !== 'event') return false;
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
    if (item.kind !== 'event') continue;
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
