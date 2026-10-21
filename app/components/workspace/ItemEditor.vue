<script setup lang="ts">
const { tr } = useLocale();

import { errorText, koreaDate, datePart, localTime } from '~/utils/display';
import { DEFAULT_ITEM_COLORS } from '~/utils/item-colors';
import type { Project } from '~/types/workspace';
const props = defineProps<{
  kind: 'project' | 'task' | 'event' | 'reminder';
  item?: Record<string, unknown>;
  projectId?: string;
  projects?: Project[];
  initialDate?: string;
  inline?: boolean;
  standalone?: boolean;
}>();
const emit = defineEmits<{ close: []; saved: [item?: { id: string }] }>();
const { request } = useApi();
const i = props.item,
  today = props.initialDate || koreaDate();
const chosenProject = ref(String(i?.projectId || props.projectId || ''));
const availableProjects = computed(() => props.projects?.filter((p) => !p.archivedAt) || []);
const inheritedProject = computed(() =>
  props.kind === 'task' || props.kind === 'event'
    ? props.projects?.find((p) => String(p.id) === chosenProject.value)
    : undefined,
);
const projectLocked = computed(() =>
  props.kind === 'task' || props.kind === 'event'
    ? Boolean(props.projectId || inheritedProject.value)
    : false,
);
const f = reactive({
  name: String(i?.name || ''),
  title: String(i?.title || ''),
  description: String(i?.description || ''),
  color: String(i?.color || DEFAULT_ITEM_COLORS[props.kind]),
  priority: String(i?.priority || 'MEDIUM'),
  status: String(i?.status || 'TODO'),
  startDate: datePart(i?.startDate as string) || today,
  dueDate: datePart(i?.dueDate as string) || today,
  endDate:
    datePart(i?.endDate as string) ||
    koreaDate(new Date(Date.parse(today + 'T12:00:00+09:00') + 86400000)),
  allDay: Boolean(i?.allDay),
  startsAt: localTime(i?.startsAt as string) || today + 'T14:00',
  endsAt: localTime(i?.endsAt as string) || today + 'T15:00',
  timing: i?.allDay ? 'CUSTOM' : '10',
  scheduledAt: localTime(new Date(Date.now() + 5 * 60_000).toISOString()),
  text: tr(`${i?.title || tr('일정')} 일정이 곧 시작해요.`),
});
const displayColor = computed({
  get: () => inheritedProject.value?.color || f.color,
  set: (value: string) => {
    f.color = value;
  },
});
const busy = ref(false),
  error = ref(''),
  dialog = ref<HTMLDialogElement>(),
  discardPromptOpen = ref(false),
  savedSuccessfully = ref(false);
const serializeForm = () => JSON.stringify({ chosenProject: chosenProject.value, form: { ...f } });
const initialSnapshot = serializeForm();
const dirty = computed(() => !savedSuccessfully.value && serializeForm() !== initialSnapshot);
let resolveDiscardPrompt: ((discard: boolean) => void) | undefined;
function confirmDiscard() {
  if (!dirty.value) return Promise.resolve(true);
  discardPromptOpen.value = true;
  return new Promise<boolean>((resolve) => {
    resolveDiscardPrompt = resolve;
  });
}
function resolveDiscard(discard: boolean) {
  discardPromptOpen.value = false;
  resolveDiscardPrompt?.(discard);
  resolveDiscardPrompt = undefined;
}
async function attemptClose() {
  if (await confirmDiscard()) emit('close');
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => {
  if (!props.inline) dialog.value?.showModal();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(() => confirmDiscard());
const title = computed(
  () =>
    ({
      project: tr('프로젝트'),
      task: tr('태스크'),
      event: tr('일정'),
      reminder: tr('Slack 알림'),
    })[props.kind] + (i?.id && props.kind !== 'reminder' ? tr(' 수정') : tr(' 추가')),
);
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    let body: Record<string, unknown> = {};
    const base = {
      title: f.title.trim(),
      description: f.description,
      ...(!inheritedProject.value ? { color: f.color } : {}),
    };
    if (props.kind === 'project')
      body = { name: f.name.trim(), description: f.description, color: f.color };
    if (props.kind === 'task') {
      if (f.startDate > f.dueDate) throw Error('마감일은 시작일 이후여야 해요.');
      body = {
        ...base,
        startDate: f.startDate,
        dueDate: f.dueDate,
        priority: f.priority,
        ...(i?.id ? { status: f.status } : { projectId: chosenProject.value || null }),
      };
    }
    if (props.kind === 'event') {
      if ((f.allDay ? f.startDate : f.startsAt) >= (f.allDay ? f.endDate : f.endsAt))
        throw Error('종료는 시작보다 뒤여야 해요.');
      body = {
        ...base,
        ...(i?.id ? {} : { projectId: chosenProject.value || null, allDay: f.allDay }),
        ...(f.allDay
          ? { startDate: f.startDate, endDate: f.endDate }
          : { startsAt: f.startsAt + ':00+09:00', endsAt: f.endsAt + ':00+09:00' }),
      };
    }
    if (props.kind === 'reminder') {
      const when =
        f.timing === 'CUSTOM'
          ? Date.parse(f.scheduledAt + ':00+09:00')
          : Date.parse(String(i?.startsAt || '')) - Number(f.timing) * 60_000;
      if (
        !Number.isFinite(when) ||
        when < Date.now() + 60_000 ||
        when > Date.now() + 120 * 86400000
      )
        throw Error('알림은 현재부터 1분 이후, 120일 이내로 설정해주세요.');
      body = {
        eventId: i?.id,
        text: f.text.trim(),
        ...(f.timing === 'CUSTOM'
          ? { scheduledAt: f.scheduledAt + ':00+09:00' }
          : { offsetMinutes: Number(f.timing) }),
      };
    }
    const resource = { project: 'projects', task: 'tasks', event: 'events', reminder: 'reminders' }[
        props.kind
      ],
      editing = Boolean(i?.id && props.kind !== 'reminder');
    const result = await request<{ id: string }>(`/api/${resource}${editing ? '/' + i?.id : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      body,
    });
    savedSuccessfully.value = true;
    emit('saved', result);
  } catch (e) {
    error.value = errorText(e, props.kind === 'reminder' ? 'reminder' : 'save');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <component
    :is="inline ? 'section' : 'dialog'"
    ref="dialog"
    :class="{ 'panel item-page-form': inline }"
    aria-labelledby="editor-title"
    @cancel.prevent="!busy && attemptClose()"
  >
    <form :aria-busy="busy" @submit.prevent="submit">
      <h2 id="editor-title">{{ tr(title) }}</h2>
      <fieldset :disabled="busy">
        <label
          v-if="
            !standalone && !item?.id && !props.projectId && (kind === 'task' || kind === 'event')
          "
          >{{ tr('프로젝트 (선택)')
          }}<span class="select-control"
            ><select v-model="chosenProject" :aria-label="tr('프로젝트 (선택)')">
              <option value="">{{ tr('프로젝트 없이 만들기') }}</option>
              <option v-for="p in availableProjects" :key="p.id" :value="String(p.id)">
                {{ p.name }}
              </option></select
            ><svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m4 6 4 4 4-4" /></svg></span
        ></label>
        <label v-if="kind === 'project'"
          >{{ tr('프로젝트 이름') }}<input v-model="f.name" required maxlength="150"
        /></label>
        <label v-else-if="kind !== 'reminder'"
          >{{ tr('제목') }}<input v-model="f.title" required maxlength="200"
        /></label>
        <label v-if="kind !== 'reminder'"
          >{{ tr('설명 (선택)') }}<textarea v-model="f.description" rows="3" />
        </label>
        <label v-if="kind !== 'reminder' && !projectLocked"
          >{{ tr('색상') }}<input v-model="displayColor" type="color" :aria-label="tr('표시 색상')"
        /></label>
        <p v-if="projectLocked && inheritedProject" class="small">
          {{ inheritedProject.name }} {{ tr('프로젝트 색상을 따라가요.') }}
        </p>
        <template v-if="kind === 'task'">
          <label>{{ tr('시작일') }}<input v-model="f.startDate" type="date" required /></label
          ><label
            >{{ tr('마감일') }}<input v-model="f.dueDate" type="date" :min="f.startDate" required
          /></label>
          <label
            >{{ tr('우선순위')
            }}<span class="select-control"
              ><select v-model="f.priority" :aria-label="tr('우선순위')">
                <option value="LOW">{{ tr('낮음') }}</option>
                <option value="MEDIUM">{{ tr('보통') }}</option>
                <option value="HIGH">{{ tr('높음') }}</option></select
              ><svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" /></svg></span
          ></label>
          <label v-if="item?.id"
            >{{ tr('상태')
            }}<span class="select-control"
              ><select v-model="f.status" :aria-label="tr('상태')">
                <option value="TODO">{{ tr('할 일') }}</option>
                <option value="IN_PROGRESS">{{ tr('진행 중') }}</option>
                <option value="DONE">{{ tr('완료') }}</option></select
              ><svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" /></svg></span
          ></label>
        </template>
        <template v-if="kind === 'event'">
          <label
            >{{ tr('일정 종류')
            }}<span class="select-control"
              ><select v-model="f.allDay" :aria-label="tr('일정 종류')" :disabled="!!item?.id">
                <option :value="false">{{ tr('시간 일정') }}</option>
                <option :value="true">{{ tr('종일 일정') }}</option></select
              ><svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" /></svg></span
          ></label>
          <p class="small">{{ tr('시간은 한국 표준시(KST) 기준이에요.') }}</p>
          <template v-if="f.allDay"
            ><label>{{ tr('시작일') }}<input v-model="f.startDate" type="date" required /></label
            ><label
              >{{ tr('종료일 (이 날짜는 제외)')
              }}<input v-model="f.endDate" type="date" required /></label
          ></template>
          <template v-else
            ><label
              >{{ tr('시작 시간')
              }}<input v-model="f.startsAt" type="datetime-local" required /></label
            ><label
              >{{ tr('종료 시간')
              }}<input v-model="f.endsAt" type="datetime-local" required /></label
          ></template>
        </template>
        <template v-if="kind === 'reminder'">
          <p class="small">{{ tr('저장하면 연결된 Slack으로 실제 알림이 예약됩니다.') }}</p>
          <p class="small">{{ tr('알림은 현재부터 1분 이후, 120일 이내로 설정해주세요.') }}</p>
          <label
            >{{ tr('알림 방식')
            }}<span class="select-control"
              ><select v-model="f.timing" :aria-label="tr('알림 방식')">
                <template v-if="!item?.allDay"
                  ><option value="10">{{ tr('시작 10분 전') }}</option>
                  <option value="30">{{ tr('시작 30분 전') }}</option></template
                >
                <option value="CUSTOM">{{ tr('직접 지정') }}</option></select
              ><svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" /></svg></span
          ></label>
          <label v-if="f.timing === 'CUSTOM'"
            >{{ tr('알림 시각 (KST)')
            }}<input v-model="f.scheduledAt" type="datetime-local" required /></label
          ><label
            >{{ tr('메시지') }}<textarea v-model="f.text" required maxlength="4000" rows="3" />
          </label>
        </template>
      </fieldset>
      <p v-if="error" role="alert" class="form-error">{{ tr(error) }}</p>
      <div class="actions">
        <button type="button" class="border-btn" :disabled="busy" @click="attemptClose">
          {{ tr('취소') }}</button
        ><button class="solid" :disabled="busy" :aria-busy="busy">
          {{ busy ? (kind === 'reminder' ? tr('알림 예약 중…') : tr('저장 중…')) : tr('저장하기') }}
        </button>
      </div>
    </form>
  </component>
  <CommonConfirmDialog
    :open="discardPromptOpen"
    :title="tr('변경사항을 버릴까요?')"
    :description="tr('저장하지 않은 내용이 있어요. 이대로 나갈까요?')"
    :confirm-label="tr('나가기')"
    @cancel="resolveDiscard(false)"
    @confirm="resolveDiscard(true)"
  />
</template>
