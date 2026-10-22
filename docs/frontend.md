# Nuxt 프론트엔드

현재 로컬 소스 기준 안내입니다. Nuxt 4·Vue 3 화면은 같은 앱의 Nitro API를 사용하며 실행 시 샘플 데이터로 대체하지 않습니다. 배포본과 운영 DB 적용 상태는 별도로 확인해야 합니다.

## 실행과 구조

루트 `.env`에 `DATABASE_URL`, `SESSION_SECRET`을 설정하고 `npm install`, `npm run dev`를 실행합니다. Windows 실행 정책에 걸리면 `npm.cmd`를 사용합니다. DB 준비는 [DB 안내](../server/db/README.md)를 따릅니다.

- `app/pages/`: 소개·로그인·플랜·프로젝트 상세·개별 항목·캘린더·리마인더·마이페이지·정책·Slack 연결 결과
- `app/layouts/default.vue`: 공통 헤더·메뉴
- `app/middleware/auth.ts`, `app/composables/useSession.ts`: 세션 확인·복원·로그아웃
- `app/components/common/`: 선택 입력·확인 모달·도움말·언어·테마
- `app/components/workspace/`: 목록·상세·등록/수정 UI
- `app/types/workspace.ts`, `app/utils/`: 응답 타입·날짜·오류·색상·분류 로직
- `assets/css/`, `public/images/`: 전역 스타일·이미지

## 화면과 API

| 기능                      | API                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 가입·로그인·세션·로그아웃 | POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/logout`                     |
| 작업 화면 통합 목록       | GET `/api/workspace`                                                                                               |
| 개별 할 일·일정 목록      | GET `/api/items?scope=standalone`                                                                                  |
| 프로젝트                  | GET/POST `/api/projects`, PATCH/DELETE `/api/projects/:id`                                                         |
| 할 일                     | GET/POST `/api/tasks`, GET/PATCH/DELETE `/api/tasks/:id`                                                           |
| 일정                      | GET/POST `/api/events`, GET/PATCH/DELETE `/api/events/:id`                                                         |
| 기간별 일정 API           | GET `/api/calendar?from=...&to=...`                                                                                |
| 알림                      | GET/POST `/api/reminders`, DELETE `/api/reminders/:id`, POST `/api/reminders/:id/reconcile`                        |
| 계정                      | PATCH `/api/account/profile`, PATCH `/api/account/password`, DELETE `/api/account/sessions`, DELETE `/api/account` |

프로젝트 단일 GET API는 없습니다. 프로젝트 상세는 통합 목록에서 항목을 찾습니다. 캘린더 화면도 통합 작업 목록의 일정을 월별로 분류하며, 월마다 기간별 캘린더 API를 호출하는 구조는 아닙니다.

상단 `/plans`는 프로젝트/개별 탭을 제공합니다. 프로젝트에는 진행 중/보관함 구분이 있습니다. `/projects`, `/items` 목록 URL은 플랜으로 이동하고 기존 상세·등록·수정 URL은 유지합니다.

플랜 등록 모달은 할 일 폼으로 열리고 일정으로 전환할 수 있습니다. 프로젝트 없이 등록하거나 기존 프로젝트·새 프로젝트를 선택합니다. 프로젝트 생성 뒤 항목 저장이 실패하면 재시도에서 생성된 프로젝트를 재사용합니다.

홈에는 오늘과 겹치는 일정, 오늘부터 3일 이내 마감인 미완료 할 일, 지연된 할 일을 표시합니다. 보관된 프로젝트 항목은 제외합니다. 오늘 00:00에 종료한 일정은 오늘 일정에 포함하지 않습니다.

## 캘린더와 날짜

캘린더에는 일정만 표시합니다. 프로젝트/프로젝트 없음 필터, 월 이동과 오늘 이동을 제공합니다. `일정 등록 페이지로 이동 →`는 `/plans?tab=individual&kind=events` 목록으로 이동하며 등록 모달을 자동으로 열지 않습니다. 날짜 칸 클릭 등록·상세 모달·인라인 수정은 제공하지 않습니다. 일정 링크는 개별 상세 또는 프로젝트 상세로 이동합니다.

시간 입력은 KST이며 API에 명시적 `+09:00`을 전달합니다. 종일 일정의 종료일은 제외하고 등록 후 시간/종일 종류를 바꿀 수 없습니다. PostgreSQL DATE는 날짜 문자열로 유지합니다.

## 계정과 Slack

마이페이지에서 닉네임을 변경할 수 있습니다. 이메일은 로그인 식별자이며 변경을 차단합니다. 비밀번호는 별도 API에서 현재 비밀번호를 확인하고 변경하며 다른 세션을 폐기합니다. 이메일 인증·비밀번호 재설정 메일은 제공하지 않습니다.

새 Slack 연결은 OAuth로만 진행하며 여러 일반 워크스페이스의 설치를 저장할 수 있습니다. 멤버 ID·DM 코드 입력 방식은 종료했고 `/challenge`, `/verify`는 로그인 검사 후 410을 반환합니다. 설정·토큰 보관·기존 수동 연결 호환은 [Slack OAuth 안내](slack-oauth.md)를 참조합니다.

연결 상태 확인은 워크스페이스·사용자·예약 목록 접근을 읽기 검사하며 메시지를 보내지 않습니다. 테스트 DM은 별도 버튼으로 보냅니다. 활성/미확정 알림은 연결 변경·해제를 막을 수 있습니다. 알림 결과가 불확실하면 중복 예약 대신 상태를 보존해 대조합니다. 예약 ID가 있어도 실제 수신 성공으로 단정하지 않습니다.

## 공통 동작과 검증

선택 입력은 `CommonSelect`, 우선순위는 `PriorityBadge`를 사용합니다. 언어·테마는 기기별 브라우저 쿠키에 저장합니다. 두 선택 메뉴는 `focusout.relatedTarget`이 null일 때 즉시 닫지 않도록 보완했습니다. 문제 PC의 실제 마우스 동작은 추가 확인이 필요합니다.

가입은 같은 IP에서 정각 기준 1시간당 20회, 로그인은 10분 구간당 10회입니다. 실패·차단 요청도 집계합니다. 429 응답에 해제 시각 헤더가 있으면 로그인/가입 화면에 KST 시각을 표시합니다. [운영 안내](vercel-operations.md)를 참조합니다.

검사 명령과 한계는 [README](../README.md), [최신 대조 기록](documentation-consistency-2026-10-22.md)을 참조합니다. 모의 API 검사·과거 빌드 결과·운영 실사용 확인은 서로 다른 증거입니다.
