<script setup lang="ts">
const { tr } = useLocale();

useHead(() => ({
  title: tr('Slack 연결 결과 · 했냐옹'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
}));
const route = useRoute();
const {
  data: connection,
  error,
  status,
  refresh,
} = useSlackConnection({
  lazy: true,
  immediate: route.query.result === 'connected',
});
const checking = computed(
  () =>
    route.query.result === 'connected' && (status.value === 'idle' || status.value === 'pending'),
);
const connected = computed(
  () =>
    route.query.result === 'connected' &&
    status.value === 'success' &&
    Boolean(connection.value?.connected),
);
const result = computed(() => {
  if (checking.value)
    return {
      title: tr('연결 상태를 확인하고 있어요'),
      message: tr('Slack에서 승인한 계정을 확인 중이에요. 잠시만 기다려주세요.'),
      tone: 'pending',
      symbol: '…',
    };
  if (connected.value)
    return {
      title: tr('Slack 연결이 완료됐어요'),
      message: tr(
        '이제 일정 알림을 개인 DM으로 받을 수 있어요. 알림을 받을 일정과 시간을 설정해보세요.',
      ),
      tone: 'success',
      symbol: '✓',
    };
  if (route.query.result === 'connected')
    return {
      title: tr('연결 상태를 다시 확인해주세요'),
      message: error.value
        ? tr('상태를 불러오지 못했어요. 다시 확인하거나 마이페이지에서 연결 상태를 확인해주세요.')
        : tr('연결된 계정을 찾지 못했어요. 마이페이지에서 Slack 연결을 다시 시작해주세요.'),
      tone: 'warning',
      symbol: '?',
    };
  switch (route.query.result) {
    case 'canceled':
      return {
        title: tr('Slack 연결을 취소했어요'),
        message: tr(
          '권한 승인이 취소되어 이번 연결은 완료되지 않았어요. 원할 때 다시 연결할 수 있어요.',
        ),
        tone: 'neutral',
        symbol: '–',
      };
    case 'invalid-state':
      return {
        title: tr('연결 요청이 만료됐어요'),
        message: tr(
          '요청 시간이 지났거나 다른 브라우저에서 열린 링크예요. 마이페이지에서 새로 연결해주세요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
    case 'login-required':
      return {
        title: tr('로그인이 필요해요'),
        message: tr(
          '로그인 시간이 만료됐어요. 다시 로그인한 뒤 마이페이지에서 Slack 연결을 시작해주세요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
    case 'reminders-active':
      return {
        title: tr('예약된 알림을 먼저 확인해주세요'),
        message: tr(
          '예약 중이거나 결과 확인이 필요한 알림이 있어요. 리마인더를 정리한 뒤 연결을 변경할 수 있어요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
    case 'missing-scope':
      return {
        title: tr('알림을 보낼 권한이 필요해요'),
        message: tr(
          'Slack 연결에 필요한 권한이 승인되지 않았어요. 마이페이지에서 다시 연결하고 요청한 권한을 확인해주세요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
    case 'rotation-unsupported':
      return {
        title: tr('연결 설정을 확인해야 해요'),
        message: tr(
          '현재 Slack 앱 설정으로는 연결을 완료할 수 없어요. 문의하기를 통해 알려주세요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
    default:
      return {
        title: tr('Slack 연결을 완료하지 못했어요'),
        message: tr(
          '연결 과정에서 문제가 생겼어요. 마이페이지에서 다시 시도해주세요. 계속 문제가 생기면 문의해주세요.',
        ),
        tone: 'warning',
        symbol: '!',
      };
  }
});
const primary = computed(() =>
  connected.value
    ? { to: '/calendar', label: tr('캘린더에서 알림 설정하기') }
    : route.query.result === 'login-required'
      ? { to: '/login?redirect=/mypage%23slack', label: tr('로그인하기') }
      : route.query.result === 'reminders-active'
        ? { to: '/reminders', label: tr('리마인더 확인하기') }
        : { to: '/mypage#slack', label: tr('마이페이지에서 다시 연결하기') },
);
const supportUrl = useRuntimeConfig().public.supportFormUrl;
</script>

<template>
  <div class="slack-result-page">
    <section
      class="slack-result-card"
      :class="'is-' + result.tone"
      aria-labelledby="slack-result-title"
      :aria-busy="checking"
    >
      <div class="slack-result-brand">
        <CommonSlackMark /><span>{{ tr('했냐옹') }} <span aria-hidden="true">×</span> Slack</span>
      </div>
      <div class="slack-result-symbol" aria-hidden="true">{{ result.symbol }}</div>
      <div class="slack-result-copy" role="status" aria-live="polite">
        <h1 id="slack-result-title">{{ tr(result.title) }}</h1>
        <p>{{ tr(result.message) }}</p>
      </div>
      <template v-if="connected">
        <dl class="slack-account-details">
          <div>
            <dt>{{ tr('워크스페이스 ID') }}</dt>
            <dd>{{ connection?.workspaceId }}</dd>
          </div>
          <div>
            <dt>{{ tr('멤버 ID') }}</dt>
            <dd>{{ connection?.memberId }}</dd>
          </div>
        </dl>
        <div class="slack-result-next">
          <strong>{{ tr('다음은 알림을 설정할 차례예요') }}</strong>
          <p>
            {{
              tr(
                '캘린더에서 일정을 선택하고 알림 시간을 설정해주세요. Slack 연결만으로 모든 일정에 알림이 자동 설정되지는 않아요.',
              )
            }}
          </p>
        </div>
      </template>
      <div v-if="!checking" class="slack-result-actions">
        <button v-if="route.query.result === 'connected' && error" class="solid" @click="refresh()">
          {{ tr('연결 상태 다시 확인') }}
        </button>
        <NuxtLink :to="primary.to" class="solid">{{ tr(primary.label) }}</NuxtLink>
        <NuxtLink
          v-if="connected || route.query.result === 'reminders-active'"
          to="/mypage#slack"
          class="border-btn"
          >{{ tr('마이페이지로 돌아가기') }}</NuxtLink
        >
        <NuxtLink v-else to="/" class="border-btn">{{ tr('홈으로') }}</NuxtLink>
      </div>
      <p v-if="!checking && !connected && supportUrl" class="slack-footnote">
        {{ tr('계속 연결이 안 되나요?') }}
        <a :href="supportUrl" target="_blank" rel="noopener noreferrer">{{ tr('문의하기 ↗') }}</a>
      </p>
    </section>
  </div>
</template>
