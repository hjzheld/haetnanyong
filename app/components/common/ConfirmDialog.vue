<script setup lang="ts">
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
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <div class="actions">
        <button type="button" class="border-btn" :disabled="busy" @click="emit('cancel')">
          취소
        </button>
        <button
          type="button"
          class="solid"
          :class="{ danger }"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? '처리 중…' : confirmLabel }}
        </button>
      </div>
    </form>
  </dialog>
</template>
