interface ReminderMessageEvent {
  title?: unknown;
  projectName?: unknown;
  startsAt?: unknown;
  startDate?: unknown;
  allDay?: unknown;
}

/** Uses the event start, not the reminder delivery time. All times are KST. */
export function defaultReminderMessage(event: ReminderMessageEvent, locale: 'ko' | 'en' = 'ko') {
  const title = String(event.title || (locale === 'en' ? 'Event' : '일정'));
  const project = event.projectName
    ? `[${String(event.projectName)}] ${locale === 'en' ? 'project ' : '프로젝트 '}`
    : '';
  let start = String(event.startDate || '').slice(0, 10);
  if (!event.allDay && event.startsAt) {
    start = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(String(event.startsAt)));
  }
  const allDay = event.allDay ? (locale === 'en' ? ' (all day)' : ' (종일 일정)') : '';
  return locale === 'en'
    ? `${project}${title} starts on ${start}.${allDay}`
    : `${project}${title} 일정이 ${start}에 시작해요.${allDay}`;
}
