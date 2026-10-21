<script setup lang="ts" generic="Value extends string | number | boolean">
const props = withDefaults(
  defineProps<{
    modelValue: Value;
    label: string;
    options: { value: Value; label: string; disabled?: boolean }[];
    disabled?: boolean;
  }>(),
  { disabled: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: Value] }>();
const id = useId();
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const open = ref(false);
const active = ref(0);
const placement = ref<Record<string, string>>({});
const selected = computed(() => props.options.find((o) => o.value === props.modelValue));
let search = '',
  searchTimer: ReturnType<typeof setTimeout> | undefined;

function position() {
  if (!trigger.value || !menu.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height || window.innerHeight;
  const availableBelow = viewportHeight - rect.bottom - 16;
  const above = availableBelow < 160 && rect.top > availableBelow;
  const height = Math.max(64, Math.min(280, above ? rect.top - 16 : availableBelow));
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 24);
  placement.value = {
    left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
    top: above ? 'auto' : `${rect.bottom + 8}px`,
    bottom: above ? `${window.innerHeight - rect.top + 8}px` : 'auto',
  };
}
async function show(direction = 1) {
  if (props.disabled || trigger.value?.matches(':disabled')) return;
  open.value = true;
  const index = props.options.findIndex((o) => o.value === props.modelValue && !o.disabled);
  active.value = index >= 0 ? index : props.options.findIndex((o) => !o.disabled);
  if (direction < 0 && index < 0) active.value = props.options.findLastIndex((o) => !o.disabled);
  await nextTick();
  position();
  await nextTick();
  menu.value?.showPopover?.();
  scrollActive();
}
function close(restoreFocus = false) {
  menu.value?.hidePopover?.();
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
function choose(index: number) {
  const option = props.options[index];
  if (!option || option.disabled || props.disabled || trigger.value?.matches(':disabled')) return;
  emit('update:modelValue', option.value);
  close(true);
}
function scrollActive() {
  void nextTick(() => {
    const option = menu.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`);
    if (!option || !menu.value) return;
    if (option.offsetTop < menu.value.scrollTop) menu.value.scrollTop = option.offsetTop;
    if (option.offsetTop + option.offsetHeight > menu.value.scrollTop + menu.value.clientHeight)
      menu.value.scrollTop = option.offsetTop + option.offsetHeight - menu.value.clientHeight;
  });
}
function move(delta: number) {
  for (let step = 1; step <= props.options.length; step++) {
    const index = (active.value + delta * step + props.options.length) % props.options.length;
    if (!props.options[index]?.disabled) {
      active.value = index;
      scrollActive();
      break;
    }
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    close();
    return;
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    event.stopPropagation();
    close(true);
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault();
    if (!open.value) {
      void show(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      choose(active.value);
      return;
    }
    if (event.key === 'Home') active.value = props.options.findIndex((o) => !o.disabled);
    else if (event.key === 'End') active.value = props.options.findLastIndex((o) => !o.disabled);
    else move(event.key === 'ArrowDown' ? 1 : -1);
    scrollActive();
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!open.value) void show();
    search += event.key.toLocaleLowerCase();
    const index = props.options.findIndex(
      (o) => !o.disabled && o.label.toLocaleLowerCase().startsWith(search),
    );
    if (index >= 0) {
      active.value = index;
      scrollActive();
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = '';
    }, 650);
  }
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close();
}
function onFocus(event: FocusEvent) {
  if (!root.value?.contains(event.target as Node)) close();
}
watch(
  () => props.disabled,
  (value) => {
    if (value) close();
  },
);
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  document.addEventListener('focusin', onFocus);
  window.addEventListener('resize', position);
  document.addEventListener('scroll', position, true);
});
onBeforeUnmount(() => {
  close();
  clearTimeout(searchTimer);
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('focusin', onFocus);
  window.removeEventListener('resize', position);
  document.removeEventListener('scroll', position, true);
});
</script>

<template>
  <span ref="root" class="app-select">
    <button
      ref="trigger"
      type="button"
      class="app-select-trigger"
      role="combobox"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="open && active >= 0 ? `${id}-${active}` : undefined"
      :disabled="disabled"
      @click="open ? close() : show()"
      @keydown="onKeydown"
    >
      <span>{{ selected?.label || label }}</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    <span
      v-if="open"
      :id="`${id}-list`"
      ref="menu"
      popover="manual"
      class="app-select-menu"
      role="listbox"
      :aria-label="label"
      :style="placement"
      @mousedown.prevent
      @keydown="onKeydown"
    >
      <button
        v-for="(option, index) in options"
        :id="`${id}-${index}`"
        :key="String(option.value)"
        type="button"
        role="option"
        tabindex="-1"
        :data-index="index"
        :aria-selected="option.value === modelValue"
        :disabled="option.disabled"
        :class="{ 'is-active': index === active }"
        @pointermove="active = index"
        @click.stop="choose(index)"
      >
        <span>{{ option.label }}</span
        ><span v-if="option.value === modelValue" aria-hidden="true">✓</span>
      </button>
    </span>
  </span>
</template>
