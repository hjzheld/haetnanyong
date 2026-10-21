<script setup lang="ts">
const { tr } = useLocale();
const router = useRouter();
function back() {
  const previous = router.options.history.state.back;
  if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//'))
    router.back();
  else void navigateTo('/');
}
</script>

<template>
  <button type="button" class="legal-back-button" @click="back">
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m8 4-6 6 6 6M2 10h15" />
    </svg>
    {{ tr('뒤로가기') }}
  </button>
</template>
