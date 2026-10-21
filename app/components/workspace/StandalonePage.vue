<script setup lang="ts">
const { tr, formatTime } = useLocale();

import type { Task, ScheduleEvent, Reminder } from '~/types/workspace';
import { datePart, labels, errorText, reminderErrorText } from '~/utils/display';
const props = defineProps<{ mode: 'create' | 'detail' | 'edit' }>();
const route = useRoute(),
  { request } = useApi();
const router = useRouter();
function goBack() {
  const previous = router.options.history.state.back;
  if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//'))
    router.back();
  else void navigateTo(projectReturnTo.value, { replace: true });
}
const resource = String(route.params.kind);
if (resource !== 'tasks' && resource !== 'events')
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
const kind = resource === 'tasks' ? 'task' : 'event',
  label = kind === 'task' ? '할 일' : '일정',
  id = String(route.params.id || '');
if (props.mode !== 'create' && !/^[1-9]\d*$/.test(id))
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
useHead(() => ({
  title: tr(
    `${label} ${props.mode === 'create' ? '등록' : props.mode === 'edit' ? '수정' : '상세'} · 했냐옹`,
  ),
}));
const {
  data: item,
  error,
  refresh,
  status: itemStatus,
} = useAsyncData(
  `standalone-${resource}-${id}`,
  () =>
    props.mode === 'create'
      ? Promise.resolve(null)
      : request<Task | ScheduleEvent>(`/api/${resource}/${id}`),
  { lazy: true, immediate: props.mode !== 'create' },
);
const loading = computed(
  () => props.mode !== 'create' && ['idle', 'pending'].includes(itemStatus.value),
);
const projectReturnTo = computed(() =>
  item.value?.projectId
    ? `/projects/${item.value.projectId}${kind === 'event' ? '?tab=events' : ''}`
    : `/plans?tab=individual&kind=${resource}`,
);
const {
  data: reminders,
  refresh: refreshReminders,
  error: reminderError,
  status: reminderStatus,
} = useAsyncData(
  `item-reminders-${resource}-${id}`,
  () =>
    kind === 'event' && props.mode !== 'create'
      ? request<Reminder[]>('/api/reminders', { query: { eventId: id } })
      : Promise.resolve([]),
  { lazy: true, immediate: kind === 'event' && props.mode === 'detail' },
);
const reminder = computed(() =>
  reminders.value?.find((r) => String(r.eventId) === id && r.status !== 'CANCELED'),
);
const task = computed(() => (kind === 'task' ? (item.value as Task | null) : null));
const schedule = computed(() => (kind === 'event' ? (item.value as ScheduleEvent | null) : null));
const editorItem = computed(() => (item.value ? { ...item.value } : undefined));
const busy = ref(false),
  actionError = ref(''),
  showReminder = ref(false),
  confirmAction = ref<'delete' | 'cancelReminder'>();
const {
  data: slackConnection,
  refresh: refreshSlack,
  error: slackError,
} = useSlackConnection({ lazy: true, immediate: false });
const checkingSlack = ref(false);
function invalidateLists() {
  clearNuxtData(['standalone-items', 'workspace-data']);
}
async function saved(result?: { id: string }) {
  invalidateLists();
  clearNuxtData(`standalone-${resource}-${id}`);
  if (props.mode === 'edit' && router.options.history.state.back === `/items/${resource}/${id}`) {
    router.back();
    return;
  }
  await navigateTo(`/items/${resource}/${result?.id || id}`, { replace: true });
}
async function remove() {
  if (!busy.value) confirmAction.value = 'delete';
}
async function confirmRemove() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const returnTo = projectReturnTo.value;
    await request(`/api/${resource}/${id}`, { method: 'DELETE' });
    invalidateLists();
    await navigateTo(returnTo);
  } catch (e) {
    actionError.value = errorText(e, 'delete');
  } finally {
    busy.value = false;
    if (!actionError.value) confirmAction.value = undefined;
  }
}
async function toggleTask() {
  if (busy.value || !task.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await request(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: { status: task.value.status === 'DONE' ? 'TODO' : 'DONE' },
    });
    await refresh();
    invalidateLists();
  } catch (e) {
    actionError.value = errorText(e, 'save');
  } finally {
    busy.value = false;
  }
}
async function cancelReminder() {
  if (!busy.value && reminder.value) confirmAction.value = 'cancelReminder';
}
async function confirmReminderCancel() {
  if (busy.value || !reminder.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await request(`/api/reminders/${reminder.value.id}`, { method: 'DELETE' });
    await refreshReminders();
    invalidateLists();
  } catch (e) {
    actionError.value = errorText(e, 'reminder');
  } finally {
    busy.value = false;
    if (!actionError.value) confirmAction.value = undefined;
  }
}
async function reminderSaved() {
  showReminder.value = false;
  await refreshReminders();
  invalidateLists();
}
async function checkReminder() {
  if (busy.value || !reminder.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const result = await request<{ status: string }>(
      `/api/reminders/${reminder.value.id}/reconcile`,
      { method: 'POST' },
    );
    if (['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING'].includes(result.status))
      actionError.value = '예약 결과를 아직 확인하지 못했어요. 2분 후 상태 확인을 눌러주세요.';
    await refreshReminders();
    invalidateLists();
  } catch (error) {
    actionError.value = errorText(error, 'reminder');
  } finally {
    busy.value = false;
  }
}
async function openReminder() {
  if (checkingSlack.value) return;
  checkingSlack.value = true;
  try {
    if (!slackConnection.value) await refreshSlack({ dedupe: 'defer' });
    if (slackError.value) {
      actionError.value = errorText(slackError.value, 'slack');
      return;
    }
    if (!slackConnection.value?.connected) {
      await navigateTo('/mypage#slack');
      return;
    }
    showReminder.value = true;
  } finally {
    checkingSlack.value = false;
  }
}
</script>
<template>
  <p v-if="busy" class="operation-status" role="status">{{ tr('변경 사항을 처리하고 있어요…') }}</p>
  <button type="button" class="border-btn" @click="goBack">← {{ tr('뒤로가기') }}</button>
  <CommonPageHeading
    :title="
      mode === 'create'
        ? tr(label) + ' ' + tr('등록')
        : mode === 'edit'
          ? tr(label) + ' ' + tr('수정')
          : item?.title || tr(label) + ' ' + tr('상세')
    "
    :description="
      tr(
        item?.projectId
          ? '프로젝트에 등록된 항목이에요.'
          : '프로젝트 없는 나의 일정과 할 일이에요.',
      )
    "
  >
    <template v-if="mode === 'detail' && item"
      ><NuxtLink class="border-btn" :to="`/items/${resource}/${id}/edit`">{{ tr('수정') }}</NuxtLink
      ><button class="border-btn" :disabled="busy" @click="remove">
        {{ tr('삭제') }}
      </button></template
    >
  </CommonPageHeading>
  <p v-if="loading" role="status">{{ tr('불러오는 중…') }}</p>
  <section v-else-if="error" class="panel" role="alert">
    <p>{{ tr(errorText(error, 'load')) }}</p>
    <button class="border-btn" @click="refresh()">{{ tr('다시 시도') }}</button>
  </section>
  <WorkspaceItemEditor
    v-else-if="mode === 'create' || (mode === 'edit' && item)"
    :key="resource + id + mode"
    :kind="kind"
    :item="editorItem"
    inline
    standalone
    @close="goBack"
    @saved="saved"
  />
  <section v-else-if="item" class="panel item-detail">
    <div class="heading">
      <h2>{{ tr(label) }} {{ tr('정보') }}</h2>
      <span
        class="item-color-sample"
        :style="{ background: item.color }"
        :aria-label="tr('색상 ') + item.color"
      />
    </div>
    <p class="item-description">{{ item.description || tr('등록된 설명이 없어요.') }}</p>
    <dl v-if="task">
      <dt>{{ tr('기간') }}</dt>
      <dd>{{ datePart(task.startDate) }} ~ {{ datePart(task.dueDate) }}</dd>
      <dt>{{ tr('우선순위') }}</dt>
      <dd><CommonPriorityBadge :priority="task.priority" /></dd>
      <dt>{{ tr('상태') }}</dt>
      <dd>{{ tr(labels[task.status]) }}</dd>
    </dl>
    <button v-if="task" class="solid" :disabled="busy" @click="toggleTask">
      {{ task.status === 'DONE' ? tr('완료 취소') : tr('완료하기') }}
    </button>
    <template v-if="schedule">
      <dl>
        <dt>{{ tr('종류') }}</dt>
        <dd>{{ schedule.allDay ? tr('종일 일정') : tr('시간 일정 · 한국 표준시(KST)') }}</dd>
        <dt>{{ tr('시작') }}</dt>
        <dd>
          {{ schedule.allDay ? datePart(schedule.startDate) : formatTime(schedule.startsAt) }}
        </dd>
        <dt>{{ tr('종료') }}</dt>
        <dd>
          {{
            schedule.allDay
              ? datePart(schedule.endDate) + tr(' (종료일 제외)')
              : formatTime(schedule.endsAt)
          }}
        </dd>
      </dl>
      <p v-if="reminderStatus === 'pending' || reminderStatus === 'idle'" role="status">
        {{ tr('알림 정보를 불러오는 중…') }}
      </p>
      <p v-else-if="reminderError" role="alert">
        {{ tr(errorText(reminderError, 'reminder')) }}
        <button class="border-btn" @click="refreshReminders()">{{ tr('다시 시도') }}</button>
      </p>
      <div v-else-if="reminder" class="reminder-detail-status">
        <div>
          <strong>{{ tr('알림') }} {{ tr(labels[reminder.status]) || reminder.status }}</strong>
          <p class="small">{{ formatTime(reminder.remindAt) }}</p>
          <p v-if="reminder.errorMessage" class="form-error">
            {{ tr(reminderErrorText(reminder.errorMessage, reminder.status)) }}
          </p>
        </div>
        <div class="reminder-actions">
          <button
            v-if="
              ['SCHEDULED', 'PENDING', 'FAILED', 'CANCEL_FAILED', 'ELAPSED'].includes(
                reminder.status,
              )
            "
            class="border-btn"
            :disabled="busy"
            @click="cancelReminder"
          >
            {{ tr('알림 취소') }}
          </button>
          <button
            v-if="
              ['UNKNOWN', 'SCHEDULING', 'CANCEL_PENDING', 'SCHEDULED'].includes(reminder.status)
            "
            class="border-btn"
            :disabled="busy"
            @click="checkReminder"
          >
            {{ tr('상태 확인') }}
          </button>
          <button
            v-if="['FAILED', 'ELAPSED'].includes(reminder.status)"
            class="border-btn"
            :disabled="busy || checkingSlack"
            @click="openReminder"
          >
            {{ tr('다시 예약') }}
          </button>
        </div>
        <p v-if="reminder.status === 'ELAPSED'" class="small">
          {{ tr('예약 시각이 지났어요. 실제 수신 여부는 Slack에서 확인해주세요.') }}
        </p>
      </div>
      <button v-else class="border-btn" :disabled="checkingSlack" @click="openReminder">
        {{ checkingSlack ? tr('연결 확인 중…') : tr('Slack 알림 설정') }}
      </button>
    </template>
  </section>
  <p v-if="actionError" role="alert" class="form-error">{{ tr(actionError) }}</p>
  <WorkspaceItemEditor
    v-if="showReminder && editorItem"
    kind="reminder"
    :item="editorItem"
    @close="showReminder = false"
    @saved="reminderSaved"
  />
  <CommonConfirmDialog
    :open="!!confirmAction"
    :title="
      confirmAction === 'delete' ? tr(`${label}을 삭제할까요?`) : tr('리마인더를 취소할까요?')
    "
    :description="
      confirmAction === 'delete'
        ? tr('삭제한 내용은 되돌릴 수 없어요. 일정에 연결된 알림도 함께 취소됩니다.')
        : tr('예약된 Slack 알림을 취소합니다.')
    "
    :confirm-label="tr('계속하기')"
    :busy="busy"
    @cancel="confirmAction = undefined"
    @confirm="confirmAction === 'delete' ? confirmRemove() : confirmReminderCancel()"
  />
</template>
