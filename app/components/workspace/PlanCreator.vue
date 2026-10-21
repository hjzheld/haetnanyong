<script setup lang="ts">
import type { Project } from '~/types/workspace';
import { errorText } from '~/utils/display';
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  saved: [result: { id: string; projectId?: string; kind: 'task' | 'event' }];
  projectCreated: [project: Project];
}>();
const { tr } = useLocale();
const { request } = useApi();
const dialog = ref<HTMLDialogElement>();
const editor = ref<{ confirmDiscard: () => Promise<boolean> }>();
const headingId = useId();
const kind = ref<'task' | 'event'>('task');
const projects = ref<Project[]>([]);
const loading = ref(false);
const error = ref('');
async function loadProjects() {
  loading.value = true;
  error.value = '';
  try {
    projects.value = (await request<Project[]>('/api/projects')).filter((p) => !p.archivedAt);
  } catch (e) {
    error.value = errorText(e, 'load');
  } finally {
    loading.value = false;
  }
}
async function requestClose() {
  if (!editor.value || (await editor.value.confirmDiscard())) emit('close');
}
async function changeKind(value: 'task' | 'event') {
  if (kind.value !== value && (!editor.value || (await editor.value.confirmDiscard())))
    kind.value = value;
}
function projectCreated(project: Project) {
  if (!projects.value.some((p) => String(p.id) === String(project.id)))
    projects.value.push(project);
  emit('projectCreated', project);
}
function saved(result?: { id: string; projectId?: string | null }) {
  if (result)
    emit('saved', {
      id: result.id,
      kind: kind.value,
      ...(result.projectId ? { projectId: result.projectId } : {}),
    });
}
watch(
  () => props.open,
  async (open) => {
    if (open) {
      kind.value = 'task';
      projects.value = [];
      error.value = '';
      await nextTick();
      dialog.value?.showModal();
      dialog.value?.querySelector<HTMLInputElement>('input')?.focus();
      void loadProjects();
    } else dialog.value?.close();
  },
  { immediate: true },
);
</script>
<template>
  <dialog
    ref="dialog"
    class="plan-create-dialog"
    :aria-labelledby="headingId"
    @cancel.prevent="requestClose"
  >
    <div class="plan-dialog-heading">
      <h2 :id="headingId">{{ tr('새 항목 만들기') }}</h2>
      <button
        type="button"
        class="border-btn plan-close"
        :aria-label="tr('닫기')"
        @click="requestClose"
      >
        ×
      </button>
    </div>
    <div class="subnav plan-kind-tabs">
      <button type="button" :aria-pressed="kind === 'task'" @click="changeKind('task')">
        {{ tr('할 일') }}
      </button>
      <button type="button" :aria-pressed="kind === 'event'" @click="changeKind('event')">
        {{ tr('일정') }}
      </button>
    </div>
    <p class="small plan-kind-description">
      {{
        kind === 'task'
          ? tr('마감일까지 끝내고 완료 체크하는 작업이에요.')
          : tr('시작과 종료 시간을 정해두는 약속이에요.')
      }}
    </p>
    <p v-if="loading" class="small" role="status">{{ tr('프로젝트 목록을 불러오고 있어요.') }}</p>
    <p v-else-if="error" class="form-error" role="alert">
      {{ tr(error) }}
      <button type="button" class="border-btn" @click="loadProjects">{{ tr('다시 시도') }}</button>
    </p>
    <WorkspaceItemEditor
      v-if="open"
      :key="kind"
      ref="editor"
      :kind="kind"
      :projects="projects"
      inline
      unframed
      allow-project-creation
      @close="emit('close')"
      @saved="saved"
      @project-created="projectCreated"
    />
  </dialog>
</template>
