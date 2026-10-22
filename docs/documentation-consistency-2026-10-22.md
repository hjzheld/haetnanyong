# 문서·구현 대조 — 2026-10-22

이 문서는 최초 대조 시점의 기록입니다. 이후 사용자가 문제 PC의 언어·테마 실제 마우스 선택이 정상 반영되는 것을 확인했습니다. 환경변수 안내는 README에서 [로컬 개발 안내](local-development.md)로 이동했습니다. 후속 코드 수정과 최종 검사 결과는 [최종 점검 보고서](code-audit-final-2026-10-22.md), 현재 확인 범위는 [검증 기록](validation.md)을 기준으로 확인합니다.

현재 작업 디렉터리의 README, `docs/` 전체 설명 파일, `server/db/README.md`를 화면·API·미들웨어·설정·SQL·검사 스크립트와 대조했습니다. 이 기록은 로컬 소스 기준이며 배포본·운영 DB의 현재 상태를 보장하지 않습니다.

## 설명을 수정한 항목

| 항목           | 이전 설명의 문제                                 | 현재 코드 기준                                                                         |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 홈             | 오늘·내일 계획으로 요약                          | 오늘 일정, 오늘부터 3일 이내 마감인 미완료 할 일, 지연된 할 일                         |
| Slack 연결     | 단일 워크스페이스·멤버 ID·DM 코드 입력           | 새 연결은 OAuth. 기존 challenge/verify는 인증 후 410. 일반 워크스페이스별 설치 저장    |
| Slack 설정     | Client Secret 누락                               | 서버에서 `SLACK_CLIENT_SECRET` 필요                                                    |
| 연결 상태 검사 | auth.test만 설명                                 | 워크스페이스·사용자·예약 목록 접근 확인. 테스트 DM은 별도                              |
| 계정           | 이메일 수정·재인증 가능                          | 이메일 변경 차단, 닉네임 수정, 별도 비밀번호 변경·다른 세션 폐기                       |
| 요청 제한      | 미구현 또는 프로세스 메모리                      | PostgreSQL 공유 저장. IP/API/고정 시간 구간 기준                                       |
| 가입 제한      | 최근 변경 미기재                                 | 시간당 20회, 로그인은 10분당 10회. 실패·차단 요청 포함                                 |
| 제한 안내      | 막연히 잠시 후 재시도                            | 응답 헤더가 있으면 다시 시도 가능한 KST 시각 표시                                      |
| 캘린더         | 직접 등록·날짜 클릭 등록·월별 API 호출 설명 혼재 | 통합 목록에서 월별 분류. 등록 링크는 개별 일정 플랜 목록으로 이동. 날짜 클릭 등록 없음 |
| 개별 플랜      | 상단 일정·태스크 → /items                        | 상단 플랜의 개별 탭. 기존 목록 URL은 리다이렉트                                        |
| DB 준비        | 시드 계정 언급·기본 테이블만 설명                | 시드 없음. 기본 스키마 외 004·005 필요, 006·007은 현재 스키마에 포함                   |
| 운영 설정      | 존재하지 않는 .env.example 참조                  | README 환경변수와 OAuth 안내로 연결                                                    |
| 이메일 토큰    | 현재 앱에서 전혀 미사용                          | 인증은 비활성화하지만 크론이 만료 토큰 테이블 정리                                     |
| 탈퇴·정기 작업 | 구현 전 정책 검토로 설명                         | 취소 시도·실패 큐 보존·계정 삭제·일일 재시도 코드 존재. 운영 장애 검증은 별도          |
| 언어·테마      | 원인 확인 중만 기재                              | null 포커스 이탈 방어 반영·로컬 모의 브라우저 검사 통과, 문제 PC 실기기 확인 남음      |
| 과거 보고서    | 당시 결과가 현재 결과처럼 읽힘                   | 과거 검사·배포·DB 상태 기록임을 명시하고 최신 안내 연결                                |

## 구현 근거

Swagger 생성 코드(`server/utils/account-openapi.ts`, `server/api/openapi.get.ts`)도 수정했습니다. 종료된 challenge/verify의 발송·연결 설명을 deprecated·410으로 바꾸고 현재 OAuth 시작·콜백·테스트 DM 경로를 추가했습니다. 프로필 요청의 불필요한 currentPassword를 제거하고 연결 상태 검사 범위, 가입·로그인 제한 기준과 응답 헤더를 명시했습니다. API 동작 로직은 변경하지 않았습니다.

- 화면·조회: `app/components/workspace/WorkspaceView.vue`, `app/pages/plans.vue`, `app/pages/items/index.vue`, `app/utils/dashboard.ts`
- 계정: `server/api/account/profile.patch.ts`, `password.patch.ts`, `index.delete.ts`
- Slack: `server/api/account/slack/`, `server/utils/slack-oauth.ts`, `server/services/slack.ts`
- 제한·재시도 시각: `server/middleware/02-rate-limit.ts`, `app/pages/login.vue`, `app/utils/rate-limit.ts`
- 선택 메뉴: `app/components/common/LanguageSwitcher.vue`, `ThemeSwitcher.vue`, `assets/css/theme.css`
- 설정·DB·정기 작업: `nuxt.config.ts`, `vercel.json`, `server/db/schema.sql`, `server/db/migrations/`, `server/api/internal/slack-cancellations.get.ts`

## 이번에 실행한 검증

- `npm run lint`: Swagger 명세 수정 후 타입 검사 통과
- 생성된 OpenAPI 31개 경로의 메서드별 실제 로컬 라우트 파일 존재, 종료 API 410·deprecated, OAuth 경로, 재시도 헤더, 프로필 필드 검사 통과
- README·docs·DB 안내 21개 문서의 상대 Markdown 링크 대상 검사: 누락 없음
- README·docs·DB 안내의 Prettier 형식 검사 통과

- `npm run test:audit`: 입력·탈퇴 보호·캘린더 범위·보관 조건 통과
- `npm run test:workspace`: 캘린더·홈 분류·언어팩 통과
- `npm run test:reminders`: 예약·취소·대조·OAuth·토큰 경로 통과
- `npm run test:performance`: 비밀번호·세션·계정·날짜·표시 효과 통과
- `node scripts/check-auth-rate-limit.mjs`: 서버 해제 시각·Retry-After 초/날짜·잘못되거나 없는 헤더 처리 통과

위 검사는 모의 DB/API 또는 순수 로직·정적 검사입니다. 회원가입 시간당 20회 설정의 실제 운영 DB 부하·경합 검사를 의미하지 않습니다. 같은 날 수행한 언어·테마 브라우저 검사는 이번 문서 대조에서 재실행하지 않았습니다. 과거 빌드·실서버 QA 기록도 재실행한 결과가 아닙니다. 방법별 결과와 남은 범위는 [검증 기록](validation.md)에 모았습니다.

운영 배포, 실제 DB 마이그레이션, 새 빈 DB 구축, 실계정 생성·탈퇴, Slack 발송·취소, 문제 PC 마우스 재현은 이번 대조에서 수행하지 않았습니다. 외부 계정 설정과 개인의 AI 활용 내역은 로컬 코드만으로 독립 검증할 수 없으므로 기존 사용자 진술과 과거 실행 기록으로 남겼습니다.
