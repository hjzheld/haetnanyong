<script setup lang="ts">
useHead({ title: '개인정보처리방침 · 했냐옹' });
const { public: config } = useRuntimeConfig();
</script>

<template>
  <article class="legal-page">
    <h1>개인정보처리방침</h1>
    <p class="small">시행일: 2026년 10월 21일</p>
    <h2>수집하는 정보</h2>
    <p>
      회원가입과 로그인에 사용하는 이메일, 비밀번호의 단방향 해시, 선택 입력한 닉네임을 저장합니다.
      이메일은 현재 인증 메일을 발송하지 않고 계정 식별자로만 사용합니다.
    </p>
    <p>Slack 연결 시 워크스페이스·멤버·DM 채널 식별자를 저장합니다.</p>
    <h2>이용 목적</h2>
    <p>로그인, 일정·태스크 관리, Slack 리마인더 발송, 오류 확인과 서비스 보안을 위해 사용합니다.</p>
    <h2>회원 탈퇴와 보관</h2>
    <p>
      탈퇴 즉시 계정과 서비스 데이터는 운영 데이터베이스에서 삭제합니다. Slack 예약 취소가 확인되지
      않은 경우에는 취소에 필요한 채널 ID와 예약 메시지 ID만 임시 보관한 뒤 삭제합니다.
    </p>
    <h2>외부 처리 서비스</h2>
    <p>
      Neon, Vercel, Slack, Sentry를 사용합니다. 오류 수집에는 비밀번호와 인증 토큰을 의도적으로
      전송하지 않습니다.
    </p>
    <h2>문의</h2>
    <p v-if="config.supportFormUrl">
      <a :href="config.supportFormUrl" target="_blank" rel="noopener noreferrer">문의 폼</a>으로
      연락할 수 있습니다.
    </p>
    <p v-else>문의 채널을 준비하고 있습니다.</p>
  </article>
</template>
