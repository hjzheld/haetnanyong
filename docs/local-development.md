# 로컬 개발 안내

소스 코드를 별도 개발 환경에서 실행할 때 필요한 설정입니다.
[배포 사이트](https://haetnanyong.vercel.app/)를 이용할 때는 이 설정이 필요하지 않습니다.

## 환경과 데이터베이스

- Node.js 22.19.0 이상, npm
- 개발용 PostgreSQL DB와 현재 스키마·운영 마이그레이션
- 샘플 계정·시드 데이터는 제공하지 않습니다. 실행 후 회원가입하고 항목을 등록합니다.

프로젝트 루트의 `.env`에 다음 값을 설정합니다. 아래 값은 예시이며 실제 비밀 값은 저장소에 포함하지 않습니다.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
```

새 DB에는 `server/db/schema.sql`의 기본 스키마와
`server/db/migrations/004-operations-and-account-deletion.sql`,
`server/db/migrations/005-email-verification.sql`의 운영 테이블·함수가 필요합니다.
Slack OAuth 테이블과 조회 인덱스는 현재 스키마에도 포함됩니다.
기존 DB에는 `006-slack-oauth.sql`, `007-user-query-indexes.sql`을 적용 상태에 맞춰 사용합니다.

기존 DB에 기본 스키마나 전체 마이그레이션을 일괄 재실행하면 테이블·제약조건 중복 오류가
발생할 수 있습니다. 신규 DB 구축 절차 전체는 별도 환경에서 실검증이 필요합니다.
관련 구조는 [데이터베이스 안내](../server/db/README.md)를 참고해주세요.

## Slack 개발 설정

Slack 연동을 로컬에서 확인할 때만 별도 개발용 앱과 다음 설정이 필요합니다.
Slack 설정 없이도 DB가 준비되면 회원가입·로그인과 플랜 관리를 사용할 수 있습니다.

```dotenv
SLACK_CLIENT_ID=YOUR_CLIENT_ID
SLACK_CLIENT_SECRET=YOUR_CLIENT_SECRET
SLACK_REDIRECT_URI=http://localhost:3000/api/account/slack/callback
SLACK_TOKEN_ENCRYPTION_KEY=YOUR_RANDOM_KEY_AT_LEAST_32_CHARACTERS
CRON_SECRET=YOUR_SEPARATE_LONG_RANDOM_SECRET
```

Slack 앱에 동일한 콜백 주소와 `users:read`, `chat:write`, `im:write` 권한을 설정합니다.
DM을 위해 App Home → Show Tabs → Messages Tab을 활성화합니다.
설치·토큰 제약은 [Slack 연결 안내](slack-oauth.md), 정기 작업은
[Vercel 운영 문서](vercel-operations.md)를 참고해주세요.

## 설치와 검사

```bash
npm install
npm run dev
```

`http://localhost:3000/login`에서 시작합니다. Windows PowerShell 실행 정책에 걸리는 경우
`npm.cmd`를 사용할 수 있습니다.

```bash
npm run lint
npm run test:audit
npm run test:workspace
npm run test:reminders
npm run test:performance
npm run build
npm run preview
```

브라우저 검사에는 실행 중인 서버와 Playwright·Chrome이 필요합니다.
현재 스크립트는 로컬 Playwright 캐시 경로에 의존하므로 새 환경에서는 경로 설정 등
추가 준비가 필요합니다.

- `node scripts/check-auth-rate-limit.mjs`: 재시도 시각 헤더 해석 검사
- `node scripts/check-appearance-focus.cjs`: 언어·테마 선택 검사. 기본 서버는
  `http://127.0.0.1:4320`이며 `CHECK_BASE_URL`로 변경할 수 있습니다.
  모의 API를 사용하고 실제 계정이나 Slack을 변경하지 않습니다.

검사별 모의 처리 여부와 실제 DB·네트워크 접근 여부를 확인한 뒤 실행해주세요.

## 요청 제한

회원가입은 같은 IP 기준 매시 정각으로 나눈 1시간당 20회, 로그인은 10분 구간당 10회까지
허용합니다. 실패·차단 요청도 포함하며 같은 공인 IP에서는 횟수를 공유합니다.
제한 응답에 해제 시각 헤더가 있으면 화면에 다시 시도 가능한 KST 시각을 표시합니다.
자세한 기준은 [운영 안내](vercel-operations.md)를 참고해주세요.
