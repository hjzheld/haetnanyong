# Slack OAuth 적용

1. Neon SQL Editor에서 `server/db/migrations/006-slack-oauth.sql`을 실행합니다.
   기존 001~005 마이그레이션이 적용된 데이터베이스가 전제입니다.
2. Vercel Production 환경 변수에 다음을 등록합니다. 로컬에서도 같은 이름을 사용합니다.
   - `SLACK_CLIENT_ID`: Slack Basic Information의 Client ID
   - `SLACK_CLIENT_SECRET`: 같은 화면의 Client Secret
   - `SLACK_REDIRECT_URI`: `https://haetnanyong.vercel.app/api/account/slack/callback`
   - `SLACK_TOKEN_ENCRYPTION_KEY`: 독립적인 랜덤 키, 32자 이상
3. 키 생성: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   키를 저장소에 넣지 마세요. 키를 변경하면 기존 토큰을 해독할 수 없습니다.
4. Slack OAuth & Permissions의 Redirect URLs에 위 주소를 저장합니다.
   Bot scopes: `users:read`, `chat:write`, `im:write`. 공개 배포를 활성화합니다.
5. 현재 구현은 일반 워크스페이스 설치를 지원합니다. Org 전체 설치와 Token Rotation은
   지원하지 않으며 성공으로 저장하지 않습니다. Token Rotation은 켜지 않은 앱을 사용합니다.
6. DB 마이그레이션 적용 후 코드를 배포합니다. 마이페이지의 Slack 연결 버튼으로 시작합니다.
   Slack 대시보드의 공유 URL은 사용자 세션에 묶인 state가 없어 계정 연결에 사용할 수 없습니다.
7. Slack에서 본인 계정으로 승인한 사용자를 사이트 계정과 연결합니다. 멤버 ID 수동 입력이나
   별도의 DM 코드 입력은 필요하지 않습니다. 관리자 대리 승인 후 다른 사람의 계정을 자동으로
   연결하는 흐름은 지원하지 않습니다. 설치 정책에 따라 관리자 승인이 필요할 수 있습니다.

## 동작과 보관

- POST `/api/account/slack/start`: 로그인·기존 알림 검사, CSRF 검사, 요청 제한,
  10분 유효 state 생성. state 해시는 DB에, 원문은 HttpOnly SameSite=Lax 쿠키에 저장합니다.
- GET `/api/account/slack/callback`: 쿠키·state·로그인 세션을 확인하고 state를 원자적으로
  소비합니다. 승인 코드를 서버에서 교환하고 사용자 확인 후 DM을 열어 연결을 저장합니다.
- 콜백은 임의 URL로 이동하지 않고 인증 코드나 Slack 원본 오류를 응답에 노출하지 않습니다.
- 앱 설치 토큰은 AES-256-GCM과 workspace ID 인증 데이터로 암호화합니다.
  설치·DM 경로·사용자 연결은 한 SQL 문장으로 저장합니다.
- 예약·취소·탈퇴 취소 재시도는 DM 채널에 연결된 설치 토큰을 조회합니다.
  기존 수동 연결은 `SLACK_BOT_TOKEN`을 사용하므로 기존 예약 정리 전 이 값은 유지합니다.
- 연결 해제는 해당 사이트 계정의 연결만 해제합니다. 같은 워크스페이스의 다른 사용자를 위해
  공유 앱을 제거하거나 토큰을 폐기하지 않습니다. 사용자가 없고 미처리 예약·취소 작업도 없는
  설치와 DM 경로는 기존 일일 `/api/internal/slack-cancellations` 작업에서 정리합니다.
- 앱 삭제·권한 철회는 Slack API 오류로 처리됩니다. 실시간 삭제 이벤트 수신은 구현하지
  않았으므로 마이페이지의 연결 표시가 즉시 갱신되지는 않습니다.

## 수동 확인

마이페이지 → Slack 연결 → 워크스페이스 선택·승인 → 연결 완료 확인 → 미래 일정 알림
예약·취소를 확인합니다. 다른 워크스페이스에서도 같은 흐름을 확인합니다. 취소, 만료된
state, 재사용 콜백, 로그아웃 후 콜백은 연결을 생성하지 않아야 합니다.
