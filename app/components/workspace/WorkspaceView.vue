<script setup lang="ts">
import type { Project, Task, ScheduleEvent, Reminder, CalendarItem } from '~/types/workspace';
import { groupCalendarItems, toCalendarItems } from '~/utils/calendar';
import {
  labels,
  koreaDate,
  datePart,
  showTime,
  errorText,
  reminderErrorText,
} from '~/utils/display';
const props = defineProps<{
  view: 'home' | 'projects' | 'detail' | 'calendar' | 'reminders';
  projectId?: string;
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
      reminders.value.filter((r) => r.status !== 'CANCELED').map((r) => [String(r.eventId), r]),
    ),
);
const selected = computed(() => projectById.value.get(props.projectId || '')),
  archived = ref(false),
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
const today = koreaDate(),
  limit = new Date(today + 'T12:00:00+09:00');
limit.setUTCDate(limit.getUTCDate() + 3);
const dueLimit = koreaDate(limit);
const due = computed(() =>
  tasks.value.filter(
    (t) => visible(t.projectId) && t.status !== 'DONE' && datePart(t.dueDate) <= dueLimit,
  ),
);
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
  projectById.value.get(String(id))?.name || '프로젝트 없음';
const itemColor = (item: { projectId: string | null; color?: string }, kind: 'task' | 'event') =>
  projectById.value.get(String(item.projectId))?.color ||
  item.color ||
  (kind === 'task' ? '#C98B8B' : '#8E8AA3');
const itemStyle = (item: { projectId: string | null; color?: string }, kind: 'task' | 'event') => ({
  '--item-color': itemColor(item, kind),
});
function calendarStyle(item: CalendarItem) {
  const color = itemColor(item, item.kind);
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return { background: color, color: luminance > 0.179 ? '#171923' : '#ffffff', border: 'none' };
}
const month = ref(today.slice(0, 7)),
  filter = ref(''),
  projectFilterOpen = ref(false),
  projectFilterRoot = ref<HTMLElement>();
const selectedProjectLabel = computed(() =>
  filter.value === 'standalone'
    ? '프로젝트 없음'
    : active.value.find((p) => String(p.id) === filter.value)?.name || '전체 프로젝트',
);
function chooseProject(value: string) {
  filter.value = value;
  projectFilterOpen.value = false;
}
function onFilterPointerDown(event: PointerEvent) {
  if (!projectFilterRoot.value?.contains(event.target as Node)) projectFilterOpen.value = false;
}
function onFilterKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') projectFilterOpen.value = false;
}
onMounted(() => {
  document.addEventListener('pointerdown', onFilterPointerDown);
  document.addEventListener('keydown', onFilterKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onFilterPointerDown);
  document.removeEventListener('keydown', onFilterKeydown);
});
const loading = computed(() => status.value === 'idle' || pending.value);
const calendar = computed(() => toCalendarItems(tasks.value, events.value));
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
        : '삭제한 태스크는 되돌릴 수 없어요.',
  };
}
function askReminderCancel(id: string) {
  deleteTarget.value = {
    url: `/api/reminders/${id}`,
    description: '예약된 Slack 알림을 취소할까요?',
  };
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
    요청을 처리하고 있어요. 잠시만 기다려주세요.
  </p>
  <Transition name="toast"
    ><div
      v-if="toastText"
      class="floating-toast"
      :class="{ error: !!actionError }"
      :role="actionError ? 'alert' : 'status'"
    >
      {{ toastText
      }}<button
        type="button"
        aria-label="알림 닫기"
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
    :title="selected?.name || titles[view]"
    :description="selected?.description || '프로젝트별로 할 일과 일정을 모아 관리해 보세요.'"
    ><button v-if="view === 'home' || view === 'projects'" class="solid" @click="edit('project')">
      + 프로젝트 만들기</button
    ><template v-if="view === 'detail' && selected"
      ><button class="border-btn" @click="edit('project', selected)">프로젝트 수정</button
      ><button
        class="border-btn"
        :disabled="busy"
        @click="mutate(`/api/projects/${selected.id}`, 'PATCH', { archived: !selected.archivedAt })"
      >
        {{ selected.archivedAt ? '복원하기' : '보관하기' }}
      </button></template
    ></CommonPageHeading
  >
  <p v-if="loading" role="status">불러오는 중…</p>
  <div v-else-if="error" role="alert" class="panel">
    <p>{{ errorText(error, 'load') }}</p>
    <button class="border-btn" @click="refresh()">다시 시도</button>
  </div>
  <p v-if="actionError" role="alert" class="form-error">{{ actionError }}</p>
  <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  <div v-if="!loading && !error && data && view === 'reminders'" class="slack-banner">
    <div>
      <strong>{{
        slackConnection?.connected
          ? 'Slack 개인 DM이 연결되어 있어요.'
          : 'Slack을 연결하고 일정 알림을 받아보세요.'
      }}</strong>
      <p class="small">
        {{
          slackConnectionError
            ? '연결 상태를 불러오지 못했어요. 마이페이지에서 다시 확인해주세요.'
            : '본인 계정을 인증하면 일정 시작 전 DM으로 알려드려요.'
        }}
      </p>
    </div>
    <NuxtLink to="/mypage#slack" class="border-btn"
      >{{ slackConnection?.connected ? 'Slack 연결 관리' : 'Slack 연결하기' }} →</NuxtLink
    >
  </div>
  <template v-if="!loading && !error && data">
    <template v-if="view === 'home'"
      ><section class="welcome">
        <div>
          <h2>작은 할 일부터 차근차근.</h2>
          <p class="small">
            할 일에는 마감일을, 약속에는 시간을 정해두세요.<br />오늘도 함께 하나씩 챙겨볼까요?
          </p>
        </div>
        <img src="/images/cat.png" alt="응원하는 했냐옹 고양이" />
      </section>
      <div class="metric-row">
        <div
          v-reveal="index"
          v-for="(metric, index) in [
            { label: '진행 중인 프로젝트', value: active.length },
            { label: '다가오는 마감', value: due.length },
            { label: '오늘 일정', value: todays.length },
            {
              label: '완료한 태스크',
              value: tasks.filter((t) => visible(t.projectId) && t.status === 'DONE').length,
            },
          ]"
          :key="metric.label"
          class="metric"
        >
          <span class="small">{{ metric.label }}</span
          ><b>{{ metric.value }}</b>
        </div>
      </div>
      <div class="columns">
        <section v-reveal class="panel">
          <div class="heading">
            <h2>다가오는 할 일</h2>
            <span class="small">지연된 할 일 · 3일 이내 마감</span>
          </div>
          <div
            v-for="t in due.slice(0, 5)"
            :key="t.id"
            class="list-row colored-item"
            :style="itemStyle(t, 'task')"
          >
            <input
              type="checkbox"
              :aria-label="t.title + ' 완료'"
              :disabled="busy"
              @change="mutate(`/api/tasks/${t.id}`, 'PATCH', { status: 'DONE' })"
            /><NuxtLink
              :to="t.projectId ? `/projects/${t.projectId}` : `/items/tasks/${t.id}`"
              class="grow"
              ><strong>{{ t.title }}</strong>
              <p class="small">
                {{ projectName(t.projectId) }} · {{ datePart(t.dueDate) }}
              </p></NuxtLink
            ><span class="badge rose">{{ labels[t.priority] }}</span>
          </div>
          <CommonEmptyState v-if="!due.length">급한 할 일은 없어요.</CommonEmptyState>
        </section>
        <section v-reveal class="panel">
          <div class="heading">
            <h2>오늘의 일정</h2>
            <NuxtLink to="/calendar" class="border-btn">캘린더 보기</NuxtLink>
          </div>
          <div
            v-for="e in todays"
            :key="e.id"
            class="list-row colored-item"
            :style="itemStyle(e, 'event')"
          >
            <NuxtLink
              class="grow"
              :to="e.projectId ? `/projects/${e.projectId}?tab=events` : `/items/events/${e.id}`"
              ><strong>{{ e.title }}</strong>
              <p class="small">{{ e.allDay ? '종일 일정' : showTime(e.startsAt) }}</p></NuxtLink
            >
          </div>
          <CommonEmptyState v-if="!todays.length">오늘은 여유로운 하루예요.</CommonEmptyState>
        </section>
      </div></template
    >
    <section v-if="view === 'home' || view === 'projects'" class="projects">
      <div class="heading">
        <h2>나의 프로젝트</h2>
        <NuxtLink v-if="view === 'home'" to="/projects">전체 보기 →</NuxtLink>
        <div v-else class="subnav">
          <button :aria-pressed="!archived" @click="archived = false">진행 중</button
          ><button :aria-pressed="archived" @click="archived = true">보관함</button>
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
        >첫 프로젝트를 만들어보세요.</CommonEmptyState
      >
    </section>
    <template v-if="view === 'detail'"
      ><NuxtLink to="/projects">← 프로젝트 목록</NuxtLink
      ><CommonEmptyState v-if="!selected">프로젝트를 찾을 수 없어요.</CommonEmptyState
      ><template v-else
        ><div class="subnav">
          <button :aria-pressed="tab === 'tasks'" @click="tab = 'tasks'">
            태스크 {{ ownTasks.length }}</button
          ><button :aria-pressed="tab === 'events'" @click="tab = 'events'">
            일정 {{ ownEvents.length }}
          </button>
        </div>
        <section v-reveal class="panel">
          <div class="heading">
            <h2>{{ tab === 'tasks' ? '할 일을 차근차근' : '시간이 있는 약속' }}</h2>
            <button
              v-if="!selected.archivedAt"
              class="solid"
              @click="edit(tab === 'tasks' ? 'task' : 'event')"
            >
              + {{ tab === 'tasks' ? '태스크' : '일정' }} 추가</button
            ><span v-else class="badge">보관된 프로젝트</span>
          </div>
          <template v-if="tab === 'tasks'"
            ><div
              v-for="t in ownTasks"
              :key="t.id"
              class="list-row colored-item"
              :style="itemStyle(t, 'task')"
            >
              <input
                type="checkbox"
                :checked="t.status === 'DONE'"
                :disabled="busy"
                :aria-label="t.title + ' 완료'"
                @change="
                  mutate(`/api/tasks/${t.id}`, 'PATCH', {
                    status: t.status === 'DONE' ? 'TODO' : 'DONE',
                  })
                "
              />
              <div class="grow">
                <strong :class="{ done: t.status === 'DONE' }">{{ t.title }}</strong>
                <p class="small">
                  {{ datePart(t.startDate) }} ~ {{ datePart(t.dueDate) }} · {{ labels[t.priority] }}
                </p>
              </div>
              <span class="badge lavender">{{ labels[t.status] }}</span
              ><button class="border-btn" @click="edit('task', t)">수정</button
              ><button class="border-btn" :disabled="busy" @click="remove('tasks', t.id)">
                삭제
              </button>
            </div>
            <CommonEmptyState v-if="!ownTasks.length" image="/images/cat-loaf.png"
              >시작일과 마감일을 정해 첫 할 일을 추가해보세요.</CommonEmptyState
            ></template
          ><template v-else
            ><div
              v-for="e in ownEvents"
              :key="e.id"
              class="list-row colored-item"
              :style="itemStyle(e, 'event')"
            >
              <div class="grow">
                <strong>{{ e.title }}</strong>
                <p class="small">
                  {{
                    e.allDay
                      ? datePart(e.startDate) + ' ~ ' + datePart(e.endDate) + ' (종료일 제외)'
                      : showTime(e.startsAt) + ' ~ ' + showTime(e.endsAt)
                  }}
                </p>
                <span v-if="reminderFor(e.id)" class="badge"
                  >알림 {{ labels[reminderFor(e.id)!.status] || reminderFor(e.id)!.status }}</span
                >
              </div>
              <button
                v-if="!selected.archivedAt && !reminderFor(e.id)"
                class="border-btn"
                @click="edit('reminder', e)"
              >
                알림 설정</button
              ><button class="border-btn" @click="edit('event', e)">수정</button
              ><button class="border-btn" :disabled="busy" @click="remove('events', e.id)">
                삭제
              </button>
            </div>
            <CommonEmptyState v-if="!ownEvents.length" image="/images/cat-sleeping.png"
              >회의나 약속을 일정으로 등록해보세요.</CommonEmptyState
            ></template
          >
        </section></template
      ></template
    >
    <template v-if="view === 'calendar'"
      ><div class="heading calendar-heading">
        <div class="actions">
          <button class="border-btn" aria-label="이전 달" @click="moveMonth(-1)">←</button>
          <h2>{{ month }}</h2>
          <button class="border-btn" aria-label="다음 달" @click="moveMonth(1)">→</button
          ><button class="border-btn" @click="month = today.slice(0, 7)">이번 달</button>
        </div>
        <div ref="projectFilterRoot" class="calendar-project-filter">
          <span class="calendar-filter-label">프로젝트</span
          ><button
            type="button"
            class="calendar-filter-trigger"
            :aria-expanded="projectFilterOpen"
            aria-haspopup="listbox"
            @click="projectFilterOpen = !projectFilterOpen"
          >
            <span>{{ selectedProjectLabel }}</span
            ><svg
              class="calendar-filter-chevron"
              :class="{ open: projectFilterOpen }"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="m5 7.5 5 5 5-5" />
            </svg></button
          ><Transition name="filter-menu"
            ><div
              v-if="projectFilterOpen"
              class="calendar-filter-menu"
              role="listbox"
              aria-label="프로젝트 필터"
              @click.stop
            >
              <button
                type="button"
                role="option"
                :aria-selected="filter === ''"
                @click="chooseProject('')"
              >
                <span>전체 프로젝트</span><span class="calendar-filter-check">✓</span></button
              ><button
                type="button"
                role="option"
                :aria-selected="filter === 'standalone'"
                @click="chooseProject('standalone')"
              >
                <span>프로젝트 없음</span><span class="calendar-filter-check">✓</span></button
              ><button
                v-for="p in active"
                :key="p.id"
                type="button"
                role="option"
                :aria-selected="filter === String(p.id)"
                @click="chooseProject(String(p.id))"
              >
                <span
                  class="calendar-filter-dot"
                  :style="{ background: p.color || '#a9a4b7' }"
                ></span
                ><span class="calendar-filter-option-name">{{ p.name }}</span
                ><span class="calendar-filter-check">✓</span>
              </button>
            </div></Transition
          >
        </div>
      </div>
      <div class="legend">태스크 마감 · 일정</div>
      <p class="calendar-scroll-hint small">좌우로 밀어서 한 주의 일정을 확인하세요.</p>
      <div class="calendar-scroll" role="region" aria-label="월간 캘린더" tabindex="0">
        <div class="calendar">
          <div v-for="d in ['일', '월', '화', '수', '목', '금', '토']" :key="d" class="weekday">
            {{ d }}
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
                :to="
                  e.projectId
                    ? `/projects/${e.projectId}${e.kind === 'event' ? '?tab=events' : ''}`
                    : `/items/${e.kind === 'task' ? 'tasks' : 'events'}/${e.id}`
                "
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
        <h2>예약한 알림</h2>
        <button class="border-btn" :disabled="pending" @click="refresh()">새로고침</button>
      </div>
      <div v-if="reminders.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>일정</th>
              <th>알림 시각</th>
              <th>방식</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reminders" :key="r.id">
              <td>
                {{ eventById.get(String(r.eventId))?.title }}
                <p v-if="r.errorMessage" class="form-error">
                  {{ reminderErrorText(r.errorMessage) }}
                </p>
              </td>
              <td>{{ showTime(r.remindAt) }}</td>
              <td>{{ r.offsetMinutes ? r.offsetMinutes + '분 전' : '직접 지정' }}</td>
              <td>
                <span class="badge lavender">{{ labels[r.status] || r.status }}</span>
              </td>
              <td>
                <button
                  v-if="['SCHEDULED', 'PENDING', 'FAILED', 'CANCEL_FAILED'].includes(r.status)"
                  class="border-btn"
                  :disabled="busy"
                  @click="askReminderCancel(r.id)"
                >
                  예약 취소</button
                ><span
                  v-else-if="['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING'].includes(r.status)"
                  class="small"
                  >처리 결과 확인 필요</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <CommonEmptyState v-else class="reminders-empty" image="/images/cat-sleeping.png"
        >프로젝트 일정에서 알림을 설정해보세요.</CommonEmptyState
      >
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
    title="정말 삭제할까요?"
    :description="deleteTarget?.description || ''"
    confirm-label="계속하기"
    :busy="busy"
    @cancel="deleteTarget = undefined"
    @confirm="confirmRemove"
  />
</template>
