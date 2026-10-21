<script setup lang="ts">
const { tr } = useLocale();

useHead(() => ({ title: tr('개인정보처리방침 · 했냐옹') }));
const { public: config } = useRuntimeConfig();
</script>

<template>
  <article class="legal-page">
    <CommonLegalBackButton />
    <h1>{{ tr('개인정보처리방침') }}</h1>
    <p class="small">{{ tr('시행일: 2026년 10월 21일') }}</p>
    <h2>{{ tr('수집하는 정보') }}</h2>
    <p>
      {{
        tr(
          '회원가입과 로그인에 사용하는 이메일, 비밀번호의 단방향 해시, 선택 입력한 닉네임을 저장합니다. 이메일은 현재 인증 메일을 발송하지 않고 계정 식별자로만 사용합니다.',
        )
      }}
    </p>
    <p>
      {{
        tr('Slack 연결 시 워크스페이스·멤버·DM 채널 식별자와 암호화된 앱 설치 토큰을 저장합니다.')
      }}
    </p>
    <h2>{{ tr('이용 목적') }}</h2>
    <p>
      {{
        tr(
          '로그인, 일정·할 일 관리, Slack 리마인더 발송, 오류 확인과 서비스 보안을 위해 사용합니다.',
        )
      }}
    </p>
    <h2>{{ tr('회원 탈퇴와 보관') }}</h2>
    <p>
      {{
        tr(
          '탈퇴 즉시 계정과 서비스 데이터는 운영 데이터베이스에서 삭제합니다. Slack 예약 취소가 확인되지 않은 경우에는 취소에 필요한 채널 ID와 예약 메시지 ID, 워크스페이스의 암호화된 앱 설치 토큰을 임시 보관합니다. 설치 토큰은 다른 연결 사용자가 있거나 예약 취소에 필요한 동안 유지하며, 연결과 취소 작업이 모두 정리되면 정기 정리 작업에서 삭제합니다.',
        )
      }}
    </p>
    <h2>{{ tr('외부 처리 서비스') }}</h2>
    <p>
      {{
        tr(
          'Neon, Vercel, Slack, Sentry를 사용합니다. 오류 수집에는 비밀번호와 인증 토큰을 의도적으로 전송하지 않습니다.',
        )
      }}
    </p>
    <h2>{{ tr('문의') }}</h2>
    <p v-if="config.supportFormUrl">
      <a :href="config.supportFormUrl" target="_blank" rel="noopener noreferrer">{{
        tr('문의 폼')
      }}</a
      >{{ tr('으로 연락할 수 있습니다.') }}
    </p>
    <p v-else>{{ tr('문의 채널을 준비하고 있습니다.') }}</p>
  </article>
</template>
