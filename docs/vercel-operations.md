# Vercel 운영 설정

## 배포 전 필수 작업

1. 기존 DB의 적용 상태를 확인한 뒤 필요한 마이그레이션만 실행한다. 새 DB 준비와 004~007의 역할은 [DB 안내](../server/db/README.md)를 따른다.
2. 005의 테이블은 정기 정리 작업에서 참조하므로 필요하다. 현재 이메일 인증 기능은 비활성화되어 있다.
3. Vercel 환경변수에 [README](../README.md)의 값을 등록한다. 현재 저장소에는 `.env.example`이 없다. 필수 값은 `DATABASE_URL`, `SESSION_SECRET`이며 Slack OAuth에는 `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, `SLACK_TOKEN_ENCRYPTION_KEY`가 필요하다. 정기 작업은 `CRON_SECRET`을 사용한다.
4. Node.js 22.19 이상을 사용한다.
5. `/api/health`를 UptimeRobot 또는 Better Stack에서 감시한다.

## 현재 이메일 정책

이메일은 로그인 식별자로만 사용한다. 현재 이메일 발송·이메일 인증·비밀번호 재설정 메일은 제공하지 않는다.

회원가입은 이메일 형식과 중복만 확인한 뒤 바로 로그인되며, 이메일 주소 변경은 별도 재인증 기능이 준비될 때까지 막혀 있다.

005 마이그레이션의 `email_verified_at`과 `email_verification_tokens`는 인증·발송에는 사용하지 않지만 정기 작업에서 만료 토큰 테이블을 정리하므로 삭제하지 않는다.

## 가입·로그인 요청 제한

Vercel 관리 화면이 아니라 `server/middleware/02-rate-limit.ts`에서 관리하며 Neon의 `api_rate_limits`에 저장한다. 같은 IP를 해시한 값과 API 경로·고정 시간 구간으로 집계한다. 같은 공인 IP의 사용자는 횟수를 공유하며 실패·차단 요청도 포함한다.

| API              | 허용 횟수    | 초기화                   |
| ---------------- | ------------ | ------------------------ |
| 회원가입         | 1시간당 20회 | 매시 정각                |
| 로그인           | 10분당 10회  | 매시 00·10·20·30·40·50분 |
| Slack OAuth 시작 | 1시간당 10회 | 매시 정각                |
| Slack 테스트 DM  | 1분당 3회    | 매분 00초                |

허용 횟수를 넘으면 429와 `Retry-After`(초), `X-RateLimit-Reset`(Unix 초)을 반환한다. 차단 요청을 반복해도 해제 시각을 뒤로 연장하지 않는다. 로그인·회원가입 화면은 이 응답 헤더로 다시 시도 가능한 KST 시각을 표시한다. 응답 헤더가 없으면 시각을 추측해 표시하지 않는다. 로컬 변경은 재배포해야 서비스에 반영된다.

## Sentry

Sentry DSN을 등록하면 Nuxt 클라이언트와 Nitro 서버 오류를 수집한다. 비밀번호, 세션 쿠키, Slack 토큰은 오류 컨텍스트로 보내지 않는다.

## Slack 취소 작업

회원 탈퇴 뒤 취소 실패 또는 시간 예산으로 미처리한 예약은 취소에 필요한 식별자·처리 메타데이터를 `slack_cancellation_jobs`에 보관한다. Vercel Cron이 `/api/internal/slack-cancellations`를 호출해 재시도한다.

큐에는 이메일·닉네임·메시지 본문을 넣지 않고 채널/예약 메시지 ID, 재시도·정리 시각과 오류 코드를 보관한다. 취소에 필요한 암호화 설치 토큰과 DM 경로는 별도 테이블에 유지한다. `vercel.json`의 `0 3 * * *`는 매일 03:00 UTC(12:00 KST)이다. 작업 예산은 인증 직후부터 25초이며 취소 후보 최대 50건, 오래된 알림 재확인 후보 최대 10건을 조회하되 예산에 따라 실제 처리 수는 줄어든다. Slack 예약 발송 자체는 Slack이 담당한다.

## 문의 폼

Google Forms를 사용할 경우 일반 액세스를 `링크가 있는 모든 사용자`로 설정하고, 응답 1개 제한·파일 업로드·결과 요약 공개는 사용하지 않는다. 완성된 응답자 링크를 `NUXT_PUBLIC_SUPPORT_FORM_URL`에 등록한다.
