# Nuxt 프론트엔드

기존 Sites 미리보기의 2.5D 스타일을 Nuxt 4의 실제 화면으로 옮겼습니다. 데이터는 같은 앱의 Nitro API를 사용하며 로컬 샘플 데이터로 대체하지 않습니다.

## 실행

루트 `.env`의 `DATABASE_URL`을 설정하고 `npm install`, `npm run dev`를 실행합니다. Windows PowerShell 실행 정책에 걸리면 `npm.cmd run dev`를 사용합니다. `/login`에서 가입하거나 기존 이메일 계정으로 로그인합니다. 가입 시 닉네임은 선택입니다.

## 구조

```text
app/
  pages/                 로그인, 홈, 프로젝트 목록/상세, 캘린더, 리마인더
  layouts/default.vue    공통 헤더, 메뉴, 사용자, 로그아웃
  middleware/auth.ts     보호 페이지의 서버/클라이언트 세션 확인
  composables/useSession.ts  쿠키 기반 세션 복원/로그아웃
  components/common/     제목과 빈 상태
  components/workspace/  목록 화면, 프로젝트 카드, 등록/수정 모달
  types/workspace.ts     API 응답 타입
  utils/display.ts       한국 시간 표시, 상태명, 오류 표시
assets/css/              기본 구조, 기존 워크스페이스, 2.5D 스타일
public/images/cat.png    도트 고양이
```

## API와 동작

| 화면                         | API                                                                |
| ---------------------------- | ------------------------------------------------------------------ |
| 로그인/가입/세션/로그아웃    | `/api/auth/login`, `/register`, `/me`, `/logout`                   |
| 홈과 프로젝트                | GET `/api/projects`, `/api/tasks`, `/api/events`, `/api/reminders` |
| 프로젝트 등록/수정/보관/복원 | POST `/api/projects`, PATCH `/api/projects/:id`                    |
| 태스크 등록/수정/완료/삭제   | POST `/api/tasks`, PATCH/DELETE `/api/tasks/:id`                   |
| 일정 등록/수정/삭제          | POST `/api/events`, PATCH/DELETE `/api/events/:id`                 |
| 월별 캘린더                  | GET `/api/calendar?from=...&to=...`                                |
| 알림 예약/취소               | POST `/api/reminders`, DELETE `/api/reminders/:id`                 |

홈은 조회한 태스크·일정에서 보관된 프로젝트를 제외하고 한국 날짜를 기준으로 계산합니다. 캘린더는 월이 바뀔 때 조회 범위를 갱신합니다. 시간 입력은 KST이며 API에는 명시적인 `+09:00`을 전달합니다. 종일 일정 종료일은 제외됩니다. 일정 종류는 등록 후 변경할 수 없습니다.

알림 저장은 실제 Slack 예약을 생성합니다. 이벤트당 한 개만 예약하며, `UNKNOWN` 등 확인이 필요한 상태를 예약 완료로 표시하지 않습니다. 활성 알림이 있는 일정 수정은 서버의 409 오류를 표시합니다. 삭제는 확인 후 요청합니다. 모달은 저장 중 중복 제출을 막고 오류 시 입력을 유지합니다.

## 검증

- `npm run lint`: 타입 검사 통과. 기존 `vue-router/volar/sfc-route-blocks` 플러그인 경고는 남아 있습니다.
- `npm run build`: Nuxt/Nitro 프로덕션 빌드 통과.
- 실제 빌드의 브라우저에서 테스트 API 응답을 사용해 로그인, 세션 기반 이동, 프로젝트·태스크·일정·알림 등록 요청 본문, 한국 시간대, 캘린더, 390px 가로 넘침 여부를 확인했습니다. 자바스크립트 예외는 없었습니다.
- 실제 Neon 변경을 포함하는 회원가입/CRUD 전체 흐름과 실제 Slack 발송·취소는 이 작업에서 실행하지 않았습니다.

기존 `chatgpt.site`는 별도의 정적 미리보기입니다. 이번 Nuxt 화면은 로컬 프로젝트에 적용되며 Nuxt 서버 배포는 별도입니다.

## 마이페이지와 Slack 연결

`/mypage`에서 이메일·닉네임·비밀번호를 수정합니다. 이메일/비밀번호 변경에는 현재 비밀번호가 필요하며, 다른 기기의 세션을 해제합니다. 이메일 소유권 인증·비밀번호 재설정 메일은 아직 제공하지 않습니다.

Slack은 현재 서버 봇이 설치된 **한 워크스페이스**를 지원합니다. 사용자는 자신의 Slack 멤버 ID만 입력하고, 봇이 보내는 DM의 12자리 인증 코드로 본인임을 확인합니다. 워크스페이스·DM 채널은 서버에서 조회합니다. 봇 토큰을 사용자에게 받지 않습니다. 코드 유효기간은 10분이며 로그인 세션에 귀속된 암호화 HttpOnly 쿠키에 인증 상태를 보관합니다. 재발송은 1분 간격입니다. 이 제한은 브라우저 쿠키 기준이며, 공개 서비스에서 대규모 악용을 막으려면 공유 저장소 기반 계정/IP 발송 제한을 추가해야 합니다.

관리자는 `.env`의 `SLACK_BOT_TOKEN`을 설정하고, Slack 앱 Bot Token Scopes에 `users:read`, `im:write`, `chat:write`를 추가한 뒤 워크스페이스에 재설치해야 합니다. `SESSION_SECRET`은 강한 랜덤 값으로 설정하는 것을 권장합니다. 없으면 서버 봇 토큰에서 암호화 키를 파생합니다. 기존 전역 `SLACK_DM_CHANNEL_ID`는 사용자 알림의 대체 수신자로 사용하지 않습니다.

마이페이지와 리마인더에 연결 설정 링크를 제공하며, 미연결 사용자가 일정의 알림 설정을 누르면 마이페이지로 이동합니다. 활성/미확정 알림이 있으면 연결 변경·해제는 막고 먼저 해당 알림을 정리하도록 안내합니다. 현재 상태 조회와 연결 변경 사이의 엄격한 동시성 직렬화는 별도 개선 대상입니다.

오늘의 일정은 한국 날짜의 00:00~다음 날 00:00과 겹치는 **일정(events)**입니다. 전날 시작해서 오늘 끝나는 시간 일정과 오늘을 포함하는 종일 일정도 표시합니다. 종료가 오늘 00:00인 일정과 보관된 프로젝트의 일정은 제외합니다. 미완료 할 일은 오늘부터 3일 이내 마감인 ‘다가오는 할 일’과 마감일이 지난 ‘지연된 할 일’로 나눕니다.

새 API는 Swagger의 `Account` 그룹에 있습니다: PATCH `/api/account/profile`, GET/DELETE `/api/account/slack`, POST `/api/account/slack/challenge`, POST `/api/account/slack/verify`.

계정 기능 검증: `node scripts/check-account.mjs`로 프로필 검증, 현재 비밀번호 확인, Slack 멤버 ID 검증, 코드 재발송 대기, 잘못된 코드/다른 사용자 차단, 활성 알림 보호, 연결 저장과 쿠키 소비, 해제를 테스트했습니다. DB와 Slack 응답은 모의 처리했습니다. 브라우저에서도 리마인더→마이페이지 이동, 프로필 저장 후 헤더 반영, 390px 레이아웃을 확인했습니다. 타입 검사와 프로덕션 빌드는 통과했으며, 실제 Slack DM 인증/Neon 변경은 실행하지 않았습니다.

Slack 공식 문서: [사용자 조회(users:read)](https://docs.slack.dev/reference/methods/users.info/), [DM 열기(im:write)](https://docs.slack.dev/reference/methods/conversations.open/), [메시지 전송(chat:write)](https://docs.slack.dev/reference/methods/chat.postMessage/).

## 캘린더 직접 등록과 날짜 처리

캘린더에는 프로젝트 일정과 개인 일정만 표시하고 할 일은 제외합니다. 상단의 일정 등록 버튼에서 개인 일정을 등록할 수 있으며, 프로젝트 일정은 프로젝트 상세에서도 등록할 수 있습니다. 보관된 프로젝트의 일정은 제외하고 프로젝트 필터로 표시 범위를 좁힙니다. 일정과 할 일은 프로젝트 없이도 등록할 수 있습니다.

PostgreSQL DATE를 드라이버가 로컬 자정의 JavaScript Date로 바꿔 JSON 직렬화 시 전날 UTC 날짜가 되는 문제를 수정했습니다. `server/db/client.ts`에서 DATE(OID 1082)는 날짜 문자열로 유지하고 TIMESTAMPTZ는 기존 파서를 사용합니다. 프론트에서도 날짜 전용 문자열과 시간대가 있는 값을 구분합니다. 캘린더 월 범위는 한국 시간대로 날짜를 변환해 비교하며 종료 경계는 제외합니다.

`node scripts/check-calendar-dates.mjs --live`로 실제 Neon의 읽기 전용 날짜 왕복과 월 경계를 확인했습니다. `node scripts/check-api-schema.mjs`의 SQL 계획 검사 40건을 통과했습니다. 브라우저 테스트에서는 캘린더의 날짜를 클릭해 선택한 프로젝트·날짜가 POST 본문에 유지되는 것을 확인했습니다. 기존 데이터 변경이나 실제 등록은 테스트에서 실행하지 않았습니다.

## 공통 입력과 화면 규칙

선택 입력은 공통 `CommonSelect`를 사용하며 캘린더 필터와 등록·수정 모달에서 같은 hover, 간격, 선택 표시와 키보드 조작을 제공합니다. 프로젝트에 속한 일정·할 일도 색상 제목과 상속된 색상, 안내를 같은 필드에 표시합니다. 우선순위는 공통 배지로 배경·글자색을 함께 구분합니다. 상세와 목록의 왼쪽 색상 띠는 사용하지 않습니다. 마이페이지 카드 버튼은 PC에서 가로 배치하고 모바일에서만 전체 너비로 맞춥니다. 자세한 기준은 `docs/ui-guidelines.md`를 참고하세요.

플랜 페이지(`/plans`)에 프로젝트/개별 탭과 도움말, 플랜 등록 모달을 제공합니다. 프로젝트는 기존 진행 중/보관함 구분을 유지합니다. 기존 `/projects`, `/items` 목록 URL은 해당 플랜 탭으로 이동하며 상세·수정 URL과 API는 유지합니다. 등록 모달은 바로 할 일/일정 폼을 표시하며 프로젝트 드롭다운으로 개별·기존 프로젝트·새 프로젝트를 선택합니다. 새 프로젝트 이름과 색상은 같은 폼에서 입력합니다. 프로젝트 생성 후 항목 저장 실패 시 기존 프로젝트를 재사용해 재시도합니다. 화면 검증은 `node scripts/check-workspace-ui.cjs`로 실행하며, API는 모의 응답으로 처리합니다.
