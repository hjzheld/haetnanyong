<script setup lang="ts">
const { tr } = useLocale();

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    busy?: boolean;
    danger?: boolean;
  }>(),
  { confirmLabel: '확인', busy: false, danger: true },
);
const emit = defineEmits<{ cancel: []; confirm: [] }>();
const dialog = ref<HTMLDialogElement>();

watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open && !dialog.value?.open) dialog.value?.showModal();
    if (!open && dialog.value?.open) dialog.value.close();
  },
  { immediate: true },
);
</script>

<template>
  <dialog ref="dialog" class="confirm-dialog" @cancel.prevent="!busy && emit('cancel')">
    <form method="dialog" @submit.prevent>
      <h2>{{ tr(title) }}</h2>
      <p>{{ tr(description) }}</p>
      <div class="actions">
        <button type="button" class="border-btn" :disabled="busy" @click="emit('cancel')">
          {{ tr('취소') }}
        </button>
        <button
          type="button"
          class="solid"
          :class="{ danger }"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? tr('처리 중…') : tr(confirmLabel) }}
        </button>
      </div>
    </form>
  </dialog>
</template>
