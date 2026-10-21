<script setup lang="ts">
const { locale, selectLocale, tr } = useLocale();
const panel = useState<'theme' | 'language' | null>('appearance-panel', () => null);
const open = computed(() => panel.value === 'language');
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
function close() {
  if (open.value) panel.value = null;
}
function dismiss() {
  close();
  trigger.value?.focus();
}
function choose(value: 'ko' | 'en') {
  selectLocale(value);
  dismiss();
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close();
}
function focusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close();
}
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>

<template>
  <div
    ref="root"
    class="language-switcher"
    @keydown.esc.stop.prevent="dismiss"
    @focusout="focusOut"
  >
    <Transition name="theme-panel">
      <section
        v-if="open"
        id="language-options-panel"
        class="language-picker"
        :aria-label="tr('언어 선택')"
      >
        <div class="language-picker-heading">
          <span class="language-picker-symbol" aria-hidden="true">A<span>가</span></span>
          <div>
            <p class="theme-picker-title">{{ tr('언어 선택') }}</p>
            <p class="theme-picker-description">{{ tr('편한 언어로 이용해보세요.') }}</p>
          </div>
        </div>
        <fieldset class="language-picker-options">
          <legend class="theme-visually-hidden">{{ tr('언어 선택') }}</legend>
          <label
            v-for="option in [
              { value: 'ko', native: '한국어', description: 'Korean', code: 'KO' },
              { value: 'en', native: 'English', description: '영어', code: 'EN' },
            ] as const"
            :key="option.value"
            class="language-option"
            :class="{ 'is-selected': locale === option.value }"
          >
            <input
              type="radio"
              name="language-preference"
              :value="option.value"
              :checked="locale === option.value"
              @change="choose(option.value)"
            />
            <span class="language-option-code" aria-hidden="true">{{ option.code }}</span>
            <span class="language-option-copy"
              ><strong :lang="option.value">{{ option.native }}</strong
              ><span>{{ tr(option.description) }}</span></span
            >
            <svg
              v-if="locale === option.value"
              class="language-option-check"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </label>
        </fieldset>
      </section>
    </Transition>
    <button
      ref="trigger"
      type="button"
      class="language-floating-button"
      :aria-label="tr('언어 선택')"
      :aria-expanded="open"
      aria-controls="language-options-panel"
      @click="panel = open ? null : 'language'"
    >
      <svg
        viewBox="0 0 24 24"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <span>{{ locale === 'ko' ? '한국어' : 'English' }}</span>
    </button>
  </div>
</template>
