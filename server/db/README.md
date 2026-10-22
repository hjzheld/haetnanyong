# Database layer

현재 로컬 SQL·API 기준 안내입니다. 운영 DB의 적용 상태는 별도로 조회해야 하며, SQL 파일은 앱 시작 시 자동 실행되지 않습니다. 샘플 계정이나 시드 데이터는 제공하지 않습니다.

## 구성

- `users`, `sessions`: 계정·비밀번호 해시·세션 토큰 해시·만료/폐기
- `projects`: 사용자별 프로젝트·색상·보관 상태
- `tasks`, `events`: 프로젝트 소속 또는 개별 항목. 개별 항목은 `project_id IS NULL`
- `reminders`: 일정별 Slack 예약·취소·불확실 상태·변경 버전
- `api_rate_limits`: IP 해시·API·시간 구간별 요청 수
- `slack_cancellation_jobs`: 탈퇴 후 미처리 예약 취소 큐
- `slack_installations`, `slack_channel_installations`, `slack_oauth_states`: 암호화 설치 토큰·DM 경로·일회용 OAuth state
- `email_verification_tokens`, `users.email_verified_at`: 향후 인증용 구조. 현재 인증·메일 발송은 비활성화하며 정기 작업에서 토큰 테이블을 정리

사용자 데이터 API는 직접 사용자 ID 또는 프로젝트/일정 소유 관계로 접근을 제한합니다. PostgreSQL DATE는 날짜 문자열로 유지합니다. 연결 확인 API는 `GET /api/health/db`이며 연결 성공만으로 모든 스키마 준비를 보장하지 않습니다.

## 새 빈 DB

1. `schema.sql`로 기본 테이블·제약조건·인덱스·Slack OAuth 테이블을 만듭니다.
2. `migrations/004-operations-and-account-deletion.sql`로 요청 제한·취소 큐·`delete_user_account` 함수를 만듭니다.
3. `migrations/005-email-verification.sql`로 인증용 열·토큰 테이블을 만듭니다. 현재 정기 작업의 테이블 참조 때문에 필요합니다.

현재 `schema.sql`에는 006의 OAuth 테이블과 007의 사용자 조회 인덱스가 이미 포함되어 있습니다. 위 순서는 SQL 정적 대조 결과이며 새 DB를 실제 구축한 종단 검증은 이번 작업에서 수행하지 않았습니다.

## 기존 DB

`schema.sql`을 다시 실행하지 않습니다. `001`~`007` 각각의 변경 내용을 실제 적용 상태와 대조해 필요한 마이그레이션만 적용합니다. 번호가 있다고 전체를 무조건 재실행하지 않습니다. `002`, `003`은 개별 항목·색상 관련 변경이고, `006`은 OAuth 구조, `007`은 tasks 사용자/마감일 및 events 사용자/시작일 인덱스입니다.

접속 값은 루트 `.env` 또는 배포 환경변수 `DATABASE_URL`로 설정합니다. 실제 접속 문자열과 토큰은 저장소에 올리지 않습니다. 실행 설정은 [로컬 개발 안내](../../docs/local-development.md), 정기 작업은 [운영 안내](../../docs/vercel-operations.md)를 참고합니다.
