<script setup lang="ts">
const { tr } = useLocale();

import type { ThemePreference } from '~/composables/useTheme';

// Keep copy together for a future locale dictionary.
const copy = {
  title: '화면 테마',
  description: '오늘의 분위기에 맞게 골라보세요.',
  trigger: '화면 테마 선택',
  options: [
    { value: 'light', label: '밝게', description: '포근하고 화사한 낮', icon: 'sun' },
    { value: 'dark', label: '어둡게', description: '로즈와 세이지를 담은 밤', icon: 'moon' },
    {
      value: 'system',
      label: '시스템 설정',
      description: '기기의 밝기 설정에 맞춰요',
      icon: 'system',
    },
  ] as const,
};
const { preference, select } = useTheme();
const activePanel = useState<'theme' | 'language' | null>('appearance-panel', () => null);
const open = computed({
  get: () => activePanel.value === 'theme',
  set: (value: boolean) => {
    if (value) activePanel.value = 'theme';
    else if (activePanel.value === 'theme') activePanel.value = null;
  },
});
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
function close() {
  open.value = false;
  trigger.value?.focus();
}
function choose(value: ThemePreference) {
  select(value);
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false;
}
function focusOut(event: FocusEvent) {
  // Clicking a label can blur the trigger before its radio receives focus.
  if (event.relatedTarget === null) return;
  if (!root.value?.contains(event.relatedTarget as Node | null)) open.value = false;
}
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>

<template>
  <aside
    ref="root"
    class="theme-switcher"
    :aria-label="tr(copy.title)"
    @keydown.esc.stop.prevent="close"
    @focusout="focusOut"
  >
    <Transition name="theme-panel">
      <div v-if="open" id="theme-options-panel" class="theme-picker">
        <p class="theme-picker-title">{{ tr(copy.title) }}</p>
        <p class="theme-picker-description">{{ tr(copy.description) }}</p>
        <fieldset class="theme-picker-options">
          <legend class="theme-visually-hidden">{{ tr(copy.title) }}</legend>
          <label
            v-for="option in copy.options"
            :key="option.value"
            class="theme-option"
            :class="{ 'is-selected': preference === option.value }"
          >
            <input
              type="radio"
              name="theme-preference"
              :value="option.value"
              :checked="preference === option.value"
              @change="choose(option.value)"
            />
            <span
              class="theme-option-swatch"
              :class="'is-' + option.value"
              aria-hidden="true"
            ></span>
            <span class="theme-option-copy"
              ><strong>{{ tr(option.label) }}</strong
              ><span>{{ tr(option.description) }}</span></span
            >
          </label>
        </fieldset>
      </div>
    </Transition>
    <div class="appearance-toolbar">
      <CommonLanguageSwitcher />
      <button
        ref="trigger"
        type="button"
        class="theme-floating-button"
        :aria-label="tr(copy.trigger)"
        :aria-expanded="open"
        aria-controls="theme-options-panel"
        @click="open = !open"
      >
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
        </svg>
        <span>{{ tr('테마') }}</span>
      </button>
    </div>
  </aside>
</template>
