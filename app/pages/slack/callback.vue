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
const {
  data: connection,
  error,
  status,
} = useSlackConnection({
  lazy: true,
  immediate: route.query.result === 'connected',
});
const connected = computed(
  () =>
    route.query.result === 'connected' && status.value === 'success' && connection.value?.connected,
);
const message = computed(() => {
  switch (route.query.result) {
    case 'connected':
      return connected.value
        ? '이제 등록한 일정 알림을 Slack DM으로 받을 수 있어요.'
        : error.value || status.value === 'success'
          ? '연결 상태를 확인하지 못했어요. 마이페이지에서 다시 확인해주세요.'
          : 'Slack 연결 상태를 확인하고 있어요.';
    case 'canceled':
      return 'Slack 연결 승인을 취소했어요. 마이페이지에서 다시 시작할 수 있어요.';
    case 'invalid-state':
      return '연결 요청이 만료되었거나 다른 브라우저에서 시작한 요청이에요. 마이페이지에서 다시 연결해주세요.';
    case 'login-required':
      return '로그인한 뒤 마이페이지에서 Slack 연결을 다시 시작해주세요.';
    case 'reminders-active':
      return '예약된 알림을 먼저 취소하거나 확인한 뒤 연결을 변경해주세요.';
    case 'missing-scope':
      return '알림에 필요한 Slack 권한이 승인되지 않았어요. 필요한 권한을 허용하고 다시 연결해주세요.';
    case 'rotation-unsupported':
      return '이 Slack 앱의 토큰 설정은 아직 지원되지 않아요. 관리자에게 문의해주세요.';
    default:
      return 'Slack 연결을 완료하지 못했어요. 마이페이지에서 다시 시작해주세요.';
  }
});
</script>

<template>
  <section class="panel" aria-labelledby="slack-result-title">
    <h1 id="slack-result-title">
      {{
        connected
          ? 'Slack 계정을 연결했어요'
          : canceled
            ? 'Slack 연결을 취소했어요'
            : 'Slack 연결 확인'
      }}
    </h1>
    <p role="status">{{ message }}</p>
    <NuxtLink to="/mypage#slack" class="border-btn">마이페이지로 돌아가기</NuxtLink>
  </section>
</template>
