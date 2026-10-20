# Database layer

이 디렉터리에 PostgreSQL 마이그레이션과 쿼리 모듈을 둡니다.

Neon 연결 확인 API: `GET /api/health/db`

실제 `DATABASE_URL`은 로컬 `.env`에만 두고 커밋하지 않습니다.

초기 테이블 순서:

1. `users` — 시드 계정과 인증 해시
2. `projects` — 사용자별 프로젝트 및 보관 상태
3. `tasks` — 프로젝트 소속 업무와 완료 상태
4. `events` — 시간/종일 일정
5. `reminders` — Slack 예약 ID, 상태, 변경 버전

모든 사용자 데이터 조회는 `user_id` 소유권 조건을 포함하고, 프로젝트 부모 관계도 같은 요청에서 검증합니다.
