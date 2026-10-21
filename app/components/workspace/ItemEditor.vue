<script setup lang="ts">
const { tr, locale } = useLocale();

import { errorText, koreaDate, datePart, localTime } from '~/utils/display';
import { DEFAULT_ITEM_COLORS } from '~/utils/item-colors';
import { defaultReminderMessage } from '~/utils/reminder-message';
import type { Project } from '~/types/workspace';
const props = defineProps<{
  kind: 'project' | 'task' | 'event' | 'reminder';
  item?: Record<string, unknown>;
  projectId?: string;
  projects?: Project[];
  initialDate?: string;
  inline?: boolean;
  standalone?: boolean;
  unframed?: boolean;
  allowProjectCreation?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  saved: [item?: { id: string; projectId?: string | null }];
  projectCreated: [project: Project];
}>();
const { request } = useApi();
const i = props.item,
  today = props.initialDate || koreaDate();
const chosenProject = ref(String(i?.projectId || props.projectId || ''));
const createdProject = ref<Project>();
const newProjectValue = '__new_project__';
const creatingProject = computed(
  () => props.allowProjectCreation && chosenProject.value === newProjectValue,
);
const availableProjects = computed(() => {
  const projects = props.projects?.filter((p) => !p.archivedAt) || [];
  return createdProject.value &&
    !projects.some((p) => String(p.id) === String(createdProject.value!.id))
    ? [...projects, createdProject.value]
    : projects;
});
const projectOptions = computed(() => [
  {
    value: '',
    label: tr(props.allowProjectCreation ? '프로젝트 없이 진행' : '프로젝트 없이 만들기'),
  },
  ...availableProjects.value.map((p) => ({ value: String(p.id), label: p.name })),
  ...(props.allowProjectCreation
    ? [{ value: newProjectValue, label: tr('새 프로젝트 등록하기') }]
    : []),
]);
const inheritedProject = computed(() =>
  props.kind === 'task' || props.kind === 'event'
    ? availableProjects.value.find((p) => String(p.id) === chosenProject.value)
    : undefined,
);
const projectLocked = computed(() =>
  props.kind === 'task' || props.kind === 'event'
    ? Boolean(props.projectId || inheritedProject.value)
    : false,
);
const f = reactive({
  name: String(i?.name || ''),
  newProjectName: '',
  newProjectColor: DEFAULT_ITEM_COLORS.project,
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
  text: defaultReminderMessage(
    {
      ...i,
      projectName:
        i?.projectName ||
        availableProjects.value.find(
          (p) => String(p.id) === String(i?.projectId || props.projectId || ''),
        )?.name,
    },
    locale.value,
  ),
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
  if (busy.value) return Promise.resolve(false);
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
  if (await confirmDiscard()) {
    savedSuccessfully.value = true;
    emit('close');
  }
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
defineExpose({ confirmDiscard });
const title = computed(
  () =>
    ({
      project: tr('프로젝트'),
      task: tr('할 일'),
      event: tr('일정'),
      reminder: tr('Slack 알림'),
    })[props.kind] + (i?.id && props.kind !== 'reminder' ? tr(' 수정') : tr(' 추가')),
);
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    if ((props.kind === 'task' || props.kind === 'event') && !f.title.trim())
      throw Error('Title cannot be empty');
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
    if (!editing && creatingProject.value && (props.kind === 'task' || props.kind === 'event')) {
      const name = f.newProjectName.trim();
      if (!name || [...name].length > 150)
        throw Error('새 프로젝트 이름을 1~150자로 입력해주세요.');
      const project = await request<Project>('/api/projects', {
        method: 'POST',
        body: { name, color: f.newProjectColor },
      });
      createdProject.value = { ...project, archivedAt: project.archivedAt || null };
      chosenProject.value = String(project.id);
      body.projectId = String(project.id);
      delete body.color;
      emit('projectCreated', createdProject.value);
    }
    const result = await request<{ id: string; projectId?: string | null }>(
      `/api/${resource}${editing ? '/' + i?.id : ''}`,
      {
        method: editing ? 'PATCH' : 'POST',
        body,
      },
    );
    savedSuccessfully.value = true;
    emit('saved', {
      ...result,
      ...(!editing && (props.kind === 'task' || props.kind === 'event')
        ? { projectId: body.projectId as string | null }
        : {}),
    });
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
    :class="{ 'item-page-form': inline, panel: inline && !unframed, 'editor-unframed': unframed }"
    :aria-labelledby="unframed ? undefined : 'editor-title'"
    :aria-label="unframed ? title : undefined"
    @cancel.prevent="!busy && attemptClose()"
  >
    <form :aria-busy="busy" @submit.prevent="submit">
      <h2 v-if="!unframed" id="editor-title">{{ tr(title) }}</h2>
      <fieldset :disabled="busy">
        <label v-if="kind === 'project'"
          >{{ tr('프로젝트 이름')
          }}<input v-model="f.name" required maxlength="150" :placeholder="tr('예: 제주도 여행')"
        /></label>
        <label v-else-if="kind !== 'reminder'"
          >{{ tr('제목')
          }}<input
            v-model="f.title"
            required
            maxlength="200"
            :placeholder="kind === 'task' ? tr('예: 발표 자료 준비하기') : tr('예: 팀 회의')"
        /></label>
        <label
          v-if="
            !standalone && !item?.id && !props.projectId && (kind === 'task' || kind === 'event')
          "
        >
          {{ tr('프로젝트 (선택)')
          }}<CommonSelect
            v-model="chosenProject"
            :label="tr('프로젝트 (선택)')"
            :options="projectOptions"
          />
        </label>
        <div v-if="creatingProject" class="new-project-fields">
          <label
            >{{ tr('새 프로젝트 이름')
            }}<input
              v-model="f.newProjectName"
              required
              maxlength="150"
              :placeholder="tr('예: 제주도 여행')"
          /></label>
          <label class="color-field"
            ><span>{{ tr('프로젝트 색상') }}</span
            ><input v-model="f.newProjectColor" type="color" :aria-label="tr('프로젝트 색상')"
          /></label>
          <p class="small">{{ tr('프로젝트와 지금 작성한 항목을 함께 추가해요.') }}</p>
        </div>
        <p v-if="createdProject && error" class="small" role="status">
          {{ tr('프로젝트는 만들어졌어요. 다시 추가하면 선택된 프로젝트에 항목만 저장해요.') }}
        </p>
        <label v-if="kind !== 'reminder'"
          >{{ tr('설명 (선택)') }}<textarea v-model="f.description" rows="3" />
        </label>
        <label v-if="kind !== 'reminder' && !creatingProject" class="color-field">
          <span>{{ tr('색상') }}</span>
          <input
            v-model="displayColor"
            type="color"
            :aria-label="tr('표시 색상')"
            :disabled="projectLocked"
          />
          <span v-if="projectLocked && inheritedProject" class="small"
            >{{ inheritedProject.name }} {{ tr('프로젝트 색상을 따라가요.') }}</span
          >
        </label>
        <template v-if="kind === 'task'">
          <label>{{ tr('시작일') }}<input v-model="f.startDate" type="date" required /></label
          ><label
            >{{ tr('마감일') }}<input v-model="f.dueDate" type="date" :min="f.startDate" required
          /></label>
          <label
            >{{ tr('우선순위')
            }}<CommonSelect
              v-model="f.priority"
              :label="tr('우선순위')"
              :options="[
                { value: 'HIGH', label: tr('높음') },
                { value: 'MEDIUM', label: tr('보통') },
                { value: 'LOW', label: tr('낮음') },
              ]"
          /></label>
          <label v-if="item?.id"
            >{{ tr('상태')
            }}<CommonSelect
              v-model="f.status"
              :label="tr('상태')"
              :options="[
                { value: 'TODO', label: tr('할 일') },
                { value: 'IN_PROGRESS', label: tr('진행 중') },
                { value: 'DONE', label: tr('완료') },
              ]"
          /></label>
        </template>
        <template v-if="kind === 'event'">
          <label
            >{{ tr('일정 종류')
            }}<CommonSelect
              v-model="f.allDay"
              :label="tr('일정 종류')"
              :disabled="!!item?.id"
              :options="[
                { value: false, label: tr('시간 일정') },
                { value: true, label: tr('종일 일정') },
              ]"
          /></label>
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
            }}<CommonSelect
              v-model="f.timing"
              :label="tr('알림 방식')"
              :options="[
                ...(!item?.allDay
                  ? [
                      { value: '10', label: tr('시작 10분 전') },
                      { value: '30', label: tr('시작 30분 전') },
                    ]
                  : []),
                { value: 'CUSTOM', label: tr('직접 지정') },
              ]"
          /></label>
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
          {{
            busy
              ? kind === 'reminder'
                ? tr('알림 예약 중…')
                : tr('저장 중…')
              : i?.id && kind !== 'reminder'
                ? tr('변경사항 저장')
                : kind === 'project'
                  ? tr('프로젝트 만들기')
                  : kind === 'task'
                    ? tr('할 일 추가하기')
                    : kind === 'event'
                      ? tr('일정 추가하기')
                      : tr('알림 예약하기')
          }}
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
