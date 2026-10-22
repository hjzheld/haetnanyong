export function eventHasEnded(
  event: { allDay?: boolean; endDate?: string | null; endsAt?: string | null },
  now: number,
) {
  const end = event.allDay
    ? event.endDate && `${event.endDate.slice(0, 10)}T00:00:00+09:00`
    : event.endsAt;
  return Boolean(end && Date.parse(end) <= now);
}

export function displayReminder<T extends { status: string; remindAt: string }>(
  reminder: T,
  now: number,
): T {
  return reminder.status === 'SCHEDULED' && Date.parse(reminder.remindAt) <= now
    ? { ...reminder, status: 'ELAPSED' }
    : reminder;
}
