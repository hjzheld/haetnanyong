<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const { tr } = useLocale();
useHead(() => ({ title: tr('플랜 · 했냐옹') }));
const route = useRoute();
const tab = computed(() => (route.query.tab === 'individual' ? 'individual' : 'projects'));
const creatorOpen = ref(false);
const help = ref<HTMLDialogElement>();
const helpButton = ref<HTMLButtonElement>();
const helpTitle = useId();
function chooseTab(value: string) {
  void navigateTo({ path: '/plans', query: { ...route.query, tab: value } }, { replace: true });
}
function closeHelp() {
  help.value?.close();
  helpButton.value?.focus();
}
async function saved(result: {
  id: string;
  projectId?: string;
  kind: 'project' | 'task' | 'event';
}) {
  creatorOpen.value = false;
  await refreshNuxtData(['workspace-data', 'standalone-items']);
  if (result.kind === 'project') await navigateTo(`/projects/${result.id}`);
  else if (result.projectId)
    await navigateTo(
      `/projects/${result.projectId}?tab=${result.kind === 'task' ? 'tasks' : 'events'}`,
    );
  else
    await navigateTo({
      path: '/plans',
      query: { tab: 'individual', kind: result.kind === 'task' ? 'tasks' : 'events' },
    });
}
</script>
<template>
  <CommonPageHeading
    :title="tr('플랜')"
    :description="tr('프로젝트부터 나만의 일정과 할 일까지, 한곳에서 관리해요.')"
  >
    <button
      ref="helpButton"
      type="button"
      class="border-btn"
      aria-haspopup="dialog"
      @click="help?.showModal()"
    >
      {{ tr('도움말') }}
    </button>
    <button type="button" class="solid" aria-haspopup="dialog" @click="creatorOpen = true">
      {{ tr('+ 플랜 등록') }}
    </button>
  </CommonPageHeading>
  <div class="subnav plan-tabs" :aria-label="tr('플랜 분류')">
    <button type="button" :aria-pressed="tab === 'projects'" @click="chooseTab('projects')">
      {{ tr('프로젝트') }}
    </button>
    <button type="button" :aria-pressed="tab === 'individual'" @click="chooseTab('individual')">
      {{ tr('개별') }}
    </button>
  </div>
  <WorkspaceView v-if="tab === 'projects'" view="projects" embedded />
  <WorkspaceIndividualPlans v-else />
  <WorkspacePlanCreator
    :open="creatorOpen"
    @close="creatorOpen = false"
    @saved="saved"
    @project-created="refreshNuxtData('workspace-data')"
  />
  <dialog
    ref="help"
    class="plan-help-dialog"
    :aria-labelledby="helpTitle"
    @cancel.prevent="closeHelp"
  >
    <div class="plan-dialog-heading">
      <h2 :id="helpTitle">{{ tr('플랜 도움말') }}</h2>
      <button
        type="button"
        class="border-btn plan-close"
        :aria-label="tr('닫기')"
        @click="closeHelp"
      >
        ×
      </button>
    </div>
    <div class="plan-help-content">
      <section>
        <h3>{{ tr('프로젝트') }}</h3>
        <p>
          {{
            tr(
              '관련된 일정과 할 일을 묶어 관리하는 공간이에요. 진행 중과 보관함으로 나눠 볼 수 있어요.',
            )
          }}
        </p>
      </section>
      <section>
        <h3>{{ tr('보관함') }}</h3>
        <p>
          {{
            tr(
              '프로젝트 탭의 보관함에서 보관한 프로젝트를 확인할 수 있어요. 프로젝트 상세에서 모든 일정이 종료되고 할 일이 전부 완료되면 보관 여부를 물어요. 예, 보관하기를 누르면 보관함으로 이동해요. 취소하면 같은 화면에서는 다시 묻지 않고, 빈 프로젝트에는 안내가 뜨지 않아요. 상세에서 직접 보관하거나 보관한 프로젝트를 복원할 수도 있어요.',
            )
          }}
        </p>
      </section>
      <section>
        <h3>{{ tr('개별') }}</h3>
        <p>{{ tr('프로젝트에 속하지 않은 개인 일정과 할 일을 모아 보여줘요.') }}</p>
      </section>
      <section>
        <h3>{{ tr('일정과 할 일의 차이') }}</h3>
        <p>
          {{
            tr(
              '일정은 회의나 약속처럼 시간을 정하는 계획이고, 할 일은 마감일까지 끝내고 완료 체크하는 작업이에요.',
            )
          }}
        </p>
      </section>
      <section>
        <h3>{{ tr('플랜 추가하기') }}</h3>
        <p>
          {{
            tr(
              '플랜 등록에서 할 일이나 일정을 작성하고 프로젝트를 선택해요. 새 프로젝트 등록하기를 고르면 이름과 색상을 함께 정할 수 있어요.',
            )
          }}
        </p>
      </section>
    </div>
    <div class="actions plan-help-actions">
      <button type="button" class="solid" @click="closeHelp">{{ tr('확인했어요') }}</button>
    </div>
  </dialog>
</template>
