<script setup lang="ts">
useHead({
  title: 'Slack 연결 · 했냐옹',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});
const route = useRoute();
const canceled = computed(() => route.query.result === 'canceled');
</script>

<template>
  <section class="panel" aria-labelledby="slack-result-title">
    <h1 id="slack-result-title">
      {{ canceled ? 'Slack 연결을 취소했어요' : 'Slack 연결 기능을 준비 중이에요' }}
    </h1>
    <p v-if="canceled">Slack 연결을 승인하지 않았어요. 마이페이지에서 다시 연결할 수 있어요.</p>
    <p v-else>
      아직 Slack 계정 연결이 완료되지 않았어요. 관리자가 연결 기능 설정을 마친 뒤 다시 시도해주세요.
    </p>
    <NuxtLink to="/mypage#slack" class="border-btn">마이페이지로 돌아가기</NuxtLink>
  </section>
</template>
