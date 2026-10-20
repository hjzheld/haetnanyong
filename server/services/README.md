# Backend services

- `auth`: 로그인, HttpOnly 세션, 로그아웃
- `projects`: 프로젝트 CRUD, 보관/복원 및 하위 알림 취소
- `tasks`: 업무 CRUD와 상태 전이
- `events`: UTC 시간 일정과 DATE 종일 일정
- `calendar`: 업무·일정 공통 응답, 기간 겹침 및 프로젝트 필터
- `dashboard`: 서울 기준 오늘/임박 업무/완료율
- `reminders`: Slack 예약, 취소, 변경 버전, UNKNOWN 상태 보존
