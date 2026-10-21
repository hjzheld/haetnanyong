# Vercel 운영 설정

## 배포 전 필수 작업

1. Neon SQL Editor에서 `004-operations-and-account-deletion.sql`을 실행한다.
2. 이미 005를 실행했다면 그대로 유지한다. 현재 이메일 인증 기능은 비활성화되어 있다.
3. Vercel 환경변수에 `.env.example` 값을 등록한다.
4. Node.js 22.19 이상을 사용한다.
5. `/api/health`를 UptimeRobot 또는 Better Stack에서 감시한다.

## 현재 이메일 정책

이메일은 로그인 식별자로만 사용한다. 현재 이메일 발송·이메일 인증·비밀번호 재설정 메일은 제공하지 않는다.

회원가입은 이메일 형식과 중복만 확인한 뒤 바로 로그인되며, 이메일 주소 변경은 별도 재인증 기능이 준비될 때까지 막혀 있다.

005 마이그레이션으로 추가된 `email_verified_at`과 `email_verification_tokens`는 이미 Neon에 존재할 수 있으므로 삭제하지 않는다. 현재 애플리케이션에서는 사용하지 않으며, 추후 이메일 발송 서비스 도입 시 재활성화할 수 있다.

## Sentry

Sentry DSN을 등록하면 Nuxt 클라이언트와 Nitro 서버 오류를 수집한다. 비밀번호, 세션 쿠키, Slack 토큰은 오류 컨텍스트로 보내지 않는다.

## Slack 취소 작업

회원 탈퇴 뒤 Slack 취소 결과가 불명확한 예약은 개인정보 없이 취소 식별자만 `slack_cancellation_jobs`에 보관한다. Vercel Cron이 `/api/internal/slack-cancellations`를 호출해 재시도한다.

## 문의 폼

Google Forms를 사용할 경우 일반 액세스를 `링크가 있는 모든 사용자`로 설정하고, 응답 1개 제한·파일 업로드·결과 요약 공개는 사용하지 않는다. 완성된 응답자 링크를 `NUXT_PUBLIC_SUPPORT_FORM_URL`에 등록한다.
