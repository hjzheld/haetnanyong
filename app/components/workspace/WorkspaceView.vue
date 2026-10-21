<script setup lang="ts">
const { tr, formatTime, formatMonth } = useLocale();

import type { Project, Task, ScheduleEvent, Reminder, CalendarItem } from '~/types/workspace';
import { groupCalendarItems, toCalendarItems } from '~/utils/calendar';
import { dashboardTasks } from '~/utils/dashboard';
import { DEFAULT_ITEM_COLORS } from '~/utils/item-colors';
import { labels, koreaDate, datePart, errorText, reminderErrorText } from '~/utils/display';
const props = defineProps<{
  view: 'home' | 'projects' | 'detail' | 'calendar' | 'reminders';
  projectId?: string;
  embedded?: boolean;
}>();
const { request } = useApi();
const {
  data: slackConnection,
  error: slackConnectionError,
  refresh: refreshSlackConnection,
} = useSlackConnection({ lazy: true, immediate: props.view === 'reminders' });
const { data, pending, status, error, refresh } = useAsyncData(
  'workspace-data',
  () =>
    request<{
      projects: Project[];
      tasks: Task[];
      events: ScheduleEvent[];
      reminders: Reminder[];
    }>('/api/workspace'),
  { lazy: true },
);
const projects = computed(() => data.value?.projects || []),
  tasks = computed(() => data.value?.tasks || []),
  events = computed(() => data.value?.events || []),
  reminders = computed(() => data.value?.reminders || []);
const projectById = computed(() => new Map(projects.value.map((p) => [String(p.id), p])));
const eventById = computed(() => new Map(events.value.map((e) => [String(e.id), e])));
const tasksByProject = computed(() => {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks.value) {
    const key = String(task.projectId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }
  return grouped;
});
const eventCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const event of events.value) {
    const key = String(event.projectId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
});
const reminderByEvent = computed(
  () =>
    new Map(
      reminders.value
        .filter((r) => !['CANCELED', 'FAILED', 'ELAPSED'].includes(r.status))
        .map((r) => [String(r.eventId), r]),
    ),
);
const selected = computed(() => projectById.value.get(props.projectId || '')),
  archived = ref(useRoute().query.archived === '1'),
  tab = ref(useRoute().query.tab === 'events' ? 'events' : 'tasks'),
  busy = ref(false),
  actionError = ref(''),
  notice = ref(''),
  deleteTarget = ref<{ url: string; description: string }>();
watchEffect(() => {
  if (props.view === 'detail' && !pending.value && data.value && !selected.value) {
    showError({ statusCode: 404, statusMessage: 'Project not found' });
  }
});
const toastText = computed(() => actionError.value || notice.value);
const workspaceRoute = useRoute();
watch(archived, (value) => {
  if (props.embedded)
    void navigateTo(
      {
        path: '/plans',
        query: { ...workspaceRoute.query, tab: 'projects', archived: value ? '1' : undefined },
      },
      { replace: true },
    );
});
let toastTimer: ReturnType<typeof setTimeout> | undefined;
watch(toastText, (value) => {
  if (toastTimer) clearTimeout(toastTimer);
  if (value)
    toastTimer = setTimeout(() => {
      notice.value = '';
      actionError.value = '';
    }, 4500);
});
onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
type Kind = 'project' | 'task' | 'event' | 'reminder';
const editor = ref<{ kind: Kind; item?: Record<string, unknown>; date?: string }>();
async function edit(kind: Kind, item?: object) {
  if (kind === 'reminder' && !slackConnection.value) {
    await refreshSlackConnection({ dedupe: 'defer' });
    if (slackConnectionError.value) {
      actionError.value = errorText(slackConnectionError.value, 'slack');
      return;
    }
  }
  if (kind === 'reminder' && !slackConnection.value?.connected) {
    void navigateTo('/mypage#slack');
    return;
  }
  editor.value = { kind, item: item ? { ...item } : undefined };
}
const ownTasks = computed(() => tasksByProject.value.get(props.projectId || '') || []),
  ownEvents = computed(() => events.value.filter((e) => String(e.projectId) === props.projectId));
const active = computed(() => projects.value.filter((p) => !p.archivedAt));
const activeIds = computed(() => new Set(active.value.map((p) => String(p.id))));
const visible = (id: string | null) => id === null || activeIds.value.has(String(id));
const today = koreaDate();
const taskGroups = computed(() => dashboardTasks(tasks.value, today, visible));
const due = computed(() => taskGroups.value.upcoming);
const overdue = computed(() => taskGroups.value.overdue);
const todays = computed(() =>
  events.value
    .filter(
      (e) =>
        visible(e.projectId) &&
        (e.allDay
          ? datePart(e.startDate) <= today && datePart(e.endDate) > today
          : Date.parse(e.startsAt!) < Date.parse(today + 'T00:00:00+09:00') + 86400000 &&
            Date.parse(e.endsAt!) > Date.parse(today + 'T00:00:00+09:00')),
    )
    .sort(
      (a, b) =>
        (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) ||
        String(a.startsAt).localeCompare(String(b.startsAt)),
    ),
);
const projectName = (id: string | null) =>
  projectById.value.get(String(id))?.name || tr('프로젝트 없음');
const itemColor = (item: { projectId: string | null; color?: string }, kind: 'task' | 'event') =>
  projectById.value.get(String(item.projectId))?.color || item.color || DEFAULT_ITEM_COLORS[kind];
function calendarStyle(item: CalendarItem) {
  const color = itemColor(item, item.kind);
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return {
    background: color,
    color: luminance > 0.179 ? 'var(--color-on-user-light)' : 'var(--color-on-user-dark)',
    border: 'none',
  };
}
const month = ref(today.slice(0, 7)),
  filter = ref('');
const projectOptions = computed(() => [
  { value: '', label: tr('전체 프로젝트') },
  { value: 'standalone', label: tr('프로젝트 없음') },
  ...active.value.map((p) => ({ value: String(p.id), label: p.name })),
]);
const loading = computed(() => status.value === 'idle' || pending.value);
const calendar = computed(() => toCalendarItems(events.value));
const days = computed(() => {
  const [y, m] = month.value.split('-').map(Number),
    first = new Date(y!, m! - 1, 1).getDay(),
    last = new Date(y!, m!, 0).getDate();
  return Array.from({ length: Math.ceil((first + last) / 7) * 7 }, (_, i) => {
    const n = i - first + 1;
    return n < 1 || n > last ? '' : month.value + '-' + String(n).padStart(2, '0');
  });
});
function moveMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  month.value = d.toISOString().slice(0, 7);
}
const calendarEntries = computed(() =>
  groupCalendarItems(
    calendar.value.filter(
      (e) =>
        visible(e.projectId) &&
        (!filter.value ||
          (filter.value === 'standalone'
            ? e.projectId === null
            : String(e.projectId) === filter.value)),
    ),
    days.value,
  ),
);
async function mutate(url: string, method: 'PATCH' | 'DELETE', body?: object) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await request(url, { method, body });
    await refresh();
    notice.value = '변경 내용을 저장했어요.';
  } catch (e) {
    actionError.value = errorText(e, method === 'DELETE' ? 'delete' : 'save');
    await refresh();
  } finally {
    busy.value = false;
  }
}
async function saved() {
  editor.value = undefined;
  await refresh();
  notice.value = '저장했어요.';
}
function remove(kind: 'tasks' | 'events', id: string) {
  deleteTarget.value = {
    url: `/api/${kind}/${id}`,
    description:
      kind === 'events'
        ? '삭제한 일정은 되돌릴 수 없고 연결된 Slack 알림도 함께 취소됩니다.'
        : '삭제한 할 일은 되돌릴 수 없어요.',
  };
}
function askReminderCancel(id: string) {
  deleteTarget.value = {
    url: `/api/reminders/${id}`,
    description: '예약된 Slack 알림을 취소할까요?',
  };
}
async function checkReminder(id: string) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const result = await request<{ status: string }>(`/api/reminders/${id}/reconcile`, {
      method: 'POST',
    });
    notice.value = ['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING'].includes(result.status)
      ? '예약 결과를 아직 확인하지 못했어요. 2분 후 상태 확인을 눌러주세요.'
      : 'Slack 예약 상태를 확인했어요.';
  } catch (error) {
    actionError.value = errorText(error, 'reminder');
  } finally {
    await refresh();
    busy.value = false;
  }
}
async function confirmRemove() {
  if (!deleteTarget.value) return;
  const target = deleteTarget.value;
  await mutate(target.url, 'DELETE');
  if (!actionError.value) deleteTarget.value = undefined;
}
function reminderFor(id: string) {
  return reminderByEvent.value.get(String(id));
}
const titles = {
  home: '오늘도, 하나씩 했냐옹?',
  projects: '나의 프로젝트',
  detail: '프로젝트',
  calendar: '전체 캘린더',
  reminders: '일정 리마인더',
};
</script>
<template>
  <p v-if="busy" class="operation-status" role="status" aria-live="polite">
    {{ tr('요청을 처리하고 있어요. 잠시만 기다려주세요.') }}
  </p>
  <Transition name="toast"
    ><div
      v-if="toastText"
      class="floating-toast"
      :class="{ error: !!actionError }"
      :role="actionError ? 'alert' : 'status'"
    >
      <span>{{ tr(toastText) }}</span
      ><button
        type="button"
        :aria-label="tr('알림 닫기')"
        @click="
          notice = '';
          actionError = '';
        "
      >
        ×
      </button>
    </div></Transition
  >
  <CommonPageHeading
    v-if="!embedded"
    :title="selected?.name || tr(titles[view])"
    :description="selected?.description || tr('프로젝트별로 할 일과 일정을 모아 관리해 보세요.')"
    ><button v-if="view === 'projects'" class="solid" @click="edit('project')">
      {{ tr('+ 프로젝트 만들기') }}</button
    ><template v-if="view === 'detail' && selected"
      ><button class="border-btn" @click="edit('project', selected)">
        {{ tr('프로젝트 수정') }}</button
      ><button
        class="border-btn"
        :disabled="busy"
        @click="mutate(`/api/projects/${selected.id}`, 'PATCH', { archived: !selected.archivedAt })"
      >
        {{ selected.archivedAt ? tr('복원하기') : tr('보관하기') }}
      </button></template
    ></CommonPageHeading
  >
  <p v-if="loading" role="status">{{ tr('불러오는 중…') }}</p>
  <div v-else-if="error" role="alert" class="panel">
    <p>{{ tr(errorText(error, 'load')) }}</p>
    <button class="border-btn" @click="refresh()">{{ tr('다시 시도') }}</button>
  </div>
  <p v-if="actionError" role="alert" class="form-error">{{ tr(actionError) }}</p>
  <p v-if="notice" role="status" class="notice">{{ tr(notice) }}</p>
  <div v-if="!loading && !error && data && view === 'reminders'" class="slack-banner">
    <div>
      <strong>{{
        slackConnection?.connected
          ? tr('Slack 개인 DM이 연결되어 있어요.')
          : tr('Slack을 연결하고 일정 알림을 받아보세요.')
      }}</strong>
      <p class="small">
        {{
          slackConnectionError
            ? tr('연결 상태를 불러오지 못했어요. 마이페이지에서 다시 확인해주세요.')
            : tr('본인 계정을 인증하면 일정 시작 전 DM으로 알려드려요.')
        }}
      </p>
    </div>
    <NuxtLink to="/mypage#slack" class="border-btn"
      >{{ slackConnection?.connected ? tr('Slack 연결 관리') : tr('Slack 연결하기') }} →</NuxtLink
    >
  </div>
  <template v-if="!loading && !error && data">
    <template v-if="view === 'home'"
      ><section class="welcome">
        <div>
          <h2>{{ tr('작은 할 일부터 차근차근.') }}</h2>
          <p class="small">
            {{ tr('할 일에는 마감일을, 약속에는 시간을 정해두세요.') }}<br />{{
              tr('오늘도 함께 하나씩 챙겨볼까요?')
            }}
          </p>
        </div>
        <img src="/images/cat.png" :alt="tr('응원하는 했냐옹 고양이')" />
      </section>
      <div class="metric-row">
        <div
          v-reveal="index"
          v-for="(metric, index) in [
            { label: tr('진행 중인 프로젝트'), value: active.length },
            { label: tr('다가오는 마감'), value: due.length },
            { label: tr('오늘 일정'), value: todays.length },
            {
              label: tr('완료한 할 일'),
              value: tasks.filter((t) => visible(t.projectId) && t.status === 'DONE').length,
            },
          ]"
          :key="tr(metric.label)"
          class="metric"
        >
          <span class="small">{{ tr(metric.label) }}</span
          ><b>{{ metric.value }}</b>
        </div>
      </div>
      <div class="columns">
        <section v-reveal class="panel">
          <div class="heading">
            <h2>{{ tr('다가오는 할 일') }}</h2>
            <span class="small">{{ tr('오늘부터 3일 이내 마감') }}</span>
          </div>
          <div v-for="t in due.slice(0, 5)" :key="t.id" class="list-row">
            <input
              type="checkbox"
              :aria-label="t.title + tr(' 완료')"
              :disabled="busy"
              @change="mutate(`/api/tasks/${t.id}`, 'PATCH', { status: 'DONE' })"
            /><NuxtLink :to="`/items/tasks/${t.id}`" class="grow"
              ><strong>{{ t.title }}</strong>
              <p class="small">
                {{ projectName(t.projectId) }} · {{ datePart(t.dueDate) }}
              </p></NuxtLink
            ><CommonPriorityBadge :priority="t.priority" />
          </div>
          <CommonEmptyState v-if="!due.length">{{ tr('급한 할 일은 없어요.') }}</CommonEmptyState>
        </section>
        <section v-reveal class="panel">
          <div class="heading">
            <h2>{{ tr('오늘의 일정') }}</h2>
            <NuxtLink to="/calendar" class="border-btn">{{ tr('캘린더 보기') }}</NuxtLink>
          </div>
          <div v-for="e in todays" :key="e.id" class="list-row">
            <NuxtLink class="grow" :to="`/items/events/${e.id}`"
              ><strong>{{ e.title }}</strong>
              <p class="small">
                {{ e.allDay ? tr('종일 일정') : formatTime(e.startsAt) }}
              </p></NuxtLink
            >
          </div>
          <CommonEmptyState v-if="!todays.length">{{
            tr('오늘은 여유로운 하루예요.')
          }}</CommonEmptyState>
        </section>
      </div>
      <section v-reveal class="panel overdue-panel">
        <div class="heading">
          <h2>
            {{ tr('지연된 할 일') }} <span class="badge">{{ overdue.length }}</span>
          </h2>
          <span class="small">{{ tr('마감일이 지난 미완료 작업') }}</span>
        </div>
        <div v-for="t in overdue" :key="t.id" class="list-row">
          <input
            type="checkbox"
            :aria-label="t.title + tr(' 완료')"
            :disabled="busy"
            @change="mutate(`/api/tasks/${t.id}`, 'PATCH', { status: 'DONE' })"
          />
          <NuxtLink :to="`/items/tasks/${t.id}`" class="grow"
            ><strong>{{ t.title }}</strong>
            <p class="small">
              {{ projectName(t.projectId) }} · {{ datePart(t.dueDate) }}
            </p></NuxtLink
          ><CommonPriorityBadge :priority="t.priority" />
        </div>
        <CommonEmptyState v-if="!overdue.length">{{
          tr('지연된 할 일이 없어요.')
        }}</CommonEmptyState>
      </section></template
    >
    <section v-if="view === 'home' || view === 'projects'" class="projects">
      <div class="heading">
        <h2>{{ tr('나의 프로젝트') }}</h2>
        <NuxtLink v-if="view === 'home'" to="/plans?tab=projects">{{ tr('전체 보기 →') }}</NuxtLink>
        <div v-else class="subnav">
          <button :aria-pressed="!archived" @click="archived = false">{{ tr('진행 중') }}</button
          ><button :aria-pressed="archived" @click="archived = true">{{ tr('보관함') }}</button>
        </div>
      </div>
      <div class="project-grid">
        <WorkspaceProjectCard
          v-for="p in view === 'home'
            ? active.slice(0, 3)
            : projects.filter((p) => !!p.archivedAt === archived)"
          :key="p.id"
          :project="p"
          :tasks="tasksByProject.get(String(p.id)) || []"
          :event-count="eventCounts.get(String(p.id)) || 0"
        />
      </div>
      <CommonEmptyState
        v-if="
          !(view === 'home' ? active : projects.filter((p) => !!p.archivedAt === archived)).length
        "
        >{{ tr('첫 프로젝트를 만들어보세요.') }}</CommonEmptyState
      >
    </section>
    <template v-if="view === 'detail'"
      ><NuxtLink to="/plans?tab=projects">{{ tr('← 프로젝트 목록') }}</NuxtLink
      ><CommonEmptyState v-if="!selected">{{ tr('프로젝트를 찾을 수 없어요.') }}</CommonEmptyState
      ><template v-else
        ><div class="subnav">
          <button :aria-pressed="tab === 'tasks'" @click="tab = 'tasks'">
            {{ tr('할 일') }} {{ ownTasks.length }}</button
          ><button :aria-pressed="tab === 'events'" @click="tab = 'events'">
            {{ tr('일정') }} {{ ownEvents.length }}
          </button>
        </div>
        <section v-reveal class="panel">
          <div class="heading">
            <h2>{{ tab === 'tasks' ? tr('할 일을 차근차근') : tr('시간이 있는 약속') }}</h2>
            <button
              v-if="!selected.archivedAt"
              class="solid"
              @click="edit(tab === 'tasks' ? 'task' : 'event')"
            >
              + {{ tab === 'tasks' ? tr('할 일') : tr('일정') }} {{ tr('추가') }}</button
            ><span v-else class="badge">{{ tr('보관된 프로젝트') }}</span>
          </div>
          <template v-if="tab === 'tasks'"
            ><div v-for="t in ownTasks" :key="t.id" class="list-row">
              <input
                type="checkbox"
                :checked="t.status === 'DONE'"
                :disabled="busy"
                :aria-label="t.title + tr(' 완료')"
                @change="
                  mutate(`/api/tasks/${t.id}`, 'PATCH', {
                    status: t.status === 'DONE' ? 'TODO' : 'DONE',
                  })
                "
              />
              <NuxtLink :to="`/items/tasks/${t.id}`" class="grow">
                <strong :class="{ done: t.status === 'DONE' }">{{ t.title }}</strong>
                <p class="small">{{ datePart(t.startDate) }} ~ {{ datePart(t.dueDate) }}</p>
              </NuxtLink>
              <CommonPriorityBadge :priority="t.priority" /><span
                v-if="t.status !== 'TODO'"
                class="badge lavender"
                >{{ tr(labels[t.status]) }}</span
              ><button class="border-btn" @click="edit('task', t)">{{ tr('수정') }}</button
              ><button class="border-btn" :disabled="busy" @click="remove('tasks', t.id)">
                {{ tr('삭제') }}
              </button>
            </div>
            <CommonEmptyState v-if="!ownTasks.length" image="/images/cat-loaf.png">{{
              tr('시작일과 마감일을 정해 첫 할 일을 추가해보세요.')
            }}</CommonEmptyState></template
          ><template v-else
            ><div v-for="e in ownEvents" :key="e.id" class="list-row">
              <NuxtLink :to="`/items/events/${e.id}`" class="grow">
                <strong>{{ e.title }}</strong>
                <p class="small">
                  {{
                    e.allDay
                      ? datePart(e.startDate) + ' ~ ' + datePart(e.endDate) + tr(' (종료일 제외)')
                      : formatTime(e.startsAt) + ' ~ ' + formatTime(e.endsAt)
                  }}
                </p>
                <span v-if="reminderFor(e.id)" class="badge"
                  >{{ tr('알림') }}
                  {{ tr(labels[reminderFor(e.id)!.status]) || reminderFor(e.id)!.status }}</span
                >
              </NuxtLink>
              <button
                v-if="!selected.archivedAt && !reminderFor(e.id)"
                class="border-btn"
                @click="edit('reminder', e)"
              >
                {{ tr('알림 설정') }}</button
              ><button class="border-btn" @click="edit('event', e)">{{ tr('수정') }}</button
              ><button class="border-btn" :disabled="busy" @click="remove('events', e.id)">
                {{ tr('삭제') }}
              </button>
            </div>
            <CommonEmptyState v-if="!ownEvents.length" image="/images/cat-sleeping.png">{{
              tr('회의나 약속을 일정으로 등록해보세요.')
            }}</CommonEmptyState></template
          >
        </section></template
      ></template
    >
    <template v-if="view === 'calendar'"
      ><div class="heading calendar-heading">
        <div class="actions">
          <button class="border-btn" :aria-label="tr('이전 달')" @click="moveMonth(-1)">←</button>
          <h2>{{ formatMonth(month) }}</h2>
          <button class="border-btn" :aria-label="tr('다음 달')" @click="moveMonth(1)">→</button
          ><button class="border-btn" @click="month = today.slice(0, 7)">
            {{ tr('이번 달') }}
          </button>
        </div>
        <label class="calendar-project-filter"
          ><span class="calendar-filter-label">{{ tr('프로젝트') }}</span
          ><CommonSelect v-model="filter" :label="tr('프로젝트 필터')" :options="projectOptions"
        /></label>
      </div>
      <div class="heading calendar-create">
        <p class="small">
          {{ tr('캘린더에는 일정만 표시돼요. 할 일은 플랜에서 확인해주세요.') }}
        </p>
        <NuxtLink class="solid" to="/items/events/new">{{ tr('+ 일정 등록') }}</NuxtLink>
      </div>
      <p class="calendar-scroll-hint small">{{ tr('좌우로 밀어서 한 주의 일정을 확인하세요.') }}</p>
      <div class="calendar-scroll" role="region" :aria-label="tr('월간 캘린더')" tabindex="0">
        <div class="calendar">
          <div
            v-for="d in [tr('일'), tr('월'), tr('화'), tr('수'), tr('목'), tr('금'), tr('토')]"
            :key="tr(d)"
            class="weekday"
          >
            {{ tr(d) }}
          </div>
          <div
            v-for="(day, index) in days"
            :key="index"
            class="day"
            :class="{ blank: !day, today: day === today }"
          >
            <span v-if="day" class="day-number">{{ Number(day.slice(-2)) }}</span
            ><template v-if="day"
              ><NuxtLink
                v-for="e in calendarEntries.get(day) || []"
                :key="e.kind + e.id"
                :to="`/items/${e.kind === 'task' ? 'tasks' : 'events'}/${e.id}`"
                :style="calendarStyle(e)"
                class="calendar-item"
                :class="{ event: e.kind === 'event' }"
                :title="e.title"
                ><span class="calendar-kind" aria-hidden="true">{{
                  e.kind === 'task' ? '□' : '•'
                }}</span
                ><span class="calendar-title">{{ e.title }}</span></NuxtLink
              ></template
            >
          </div>
        </div>
      </div></template
    >
    <section v-if="view === 'reminders'" class="panel">
      <div class="heading">
        <h2>{{ tr('예약한 알림') }}</h2>
        <button class="border-btn" :disabled="pending" @click="refresh()">
          {{ tr('새로고침') }}
        </button>
      </div>
      <div v-if="reminders.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ tr('일정') }}</th>
              <th>{{ tr('알림 시각') }}</th>
              <th>{{ tr('방식') }}</th>
              <th>{{ tr('상태') }}</th>
              <th>{{ tr('관리') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reminders" :key="r.id">
              <td>
                {{ eventById.get(String(r.eventId))?.title }}
                <p v-if="r.errorMessage" class="form-error">
                  {{ tr(reminderErrorText(r.errorMessage)) }}
                </p>
              </td>
              <td>{{ formatTime(r.remindAt) }}</td>
              <td>{{ r.offsetMinutes ? r.offsetMinutes + tr('분 전') : tr('직접 지정') }}</td>
              <td>
                <span class="badge lavender">{{ tr(labels[r.status]) || r.status }}</span>
                <p v-if="r.status === 'ELAPSED'" class="small">
                  {{ tr('예약 시각이 지났어요. 실제 수신 여부는 Slack에서 확인해주세요.') }}
                </p>
              </td>
              <td class="btn-wrap">
                <button
                  v-if="
                    ['SCHEDULED', 'PENDING', 'FAILED', 'CANCEL_FAILED', 'ELAPSED'].includes(
                      r.status,
                    )
                  "
                  class="border-btn"
                  :disabled="busy"
                  @click="askReminderCancel(r.id)"
                >
                  {{ tr('예약 취소') }}
                </button>
                <button
                  v-if="['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING', 'SCHEDULED'].includes(r.status)"
                  class="border-btn"
                  :disabled="busy"
                  @click="checkReminder(r.id)"
                >
                  {{ tr('상태 확인') }}
                </button>
                <button
                  v-if="
                    ['FAILED', 'ELAPSED', 'CANCELED'].includes(r.status) &&
                    eventById.get(String(r.eventId))
                  "
                  class="border-btn"
                  :disabled="busy"
                  @click="edit('reminder', eventById.get(String(r.eventId)))"
                >
                  {{ tr('다시 예약') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <CommonEmptyState v-else class="reminders-empty" image="/images/cat-sleeping.png">{{
        tr('일정 상세에서 Slack 알림을 설정해보세요.')
      }}</CommonEmptyState>
    </section>
  </template>
  <WorkspaceItemEditor
    v-if="editor"
    :kind="editor.kind"
    :item="editor.item"
    :project-id="projectId"
    :projects="projects"
    :initial-date="editor.date"
    @close="editor = undefined"
    @saved="saved"
  />
  <CommonConfirmDialog
    :open="!!deleteTarget"
    :title="tr('정말 삭제할까요?')"
    :description="deleteTarget?.description || ''"
    :confirm-label="tr('계속하기')"
    :busy="busy"
    @cancel="deleteTarget = undefined"
    @confirm="confirmRemove"
  />
</template>
