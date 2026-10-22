const security = [{ sessionCookie: [] }];
const json = (schema: object) => ({ 'application/json': { schema } });
const request = (properties: Record<string, object>, required: string[]) => ({
  required: true,
  content: json({ type: 'object', properties, required }),
});
const responses = {
  200: { description: '성공', content: json({ type: 'object' }) },
  400: { description: '입력값·현재 비밀번호 오류' },
  401: { description: '로그인 필요' },
  409: { description: '닉네임 중복·이메일 변경 차단·활성 알림 또는 상태 충돌' },
  429: { description: '요청 횟수 초과. Retry-After와 X-RateLimit-Reset 확인' },
  502: { description: 'Slack 인증/권한/호출 오류' },
  503: { description: '서버 Slack 설정 누락' },
};
export const accountPaths = {
  '/account': {
    delete: {
      tags: ['Account'],
      summary: '회원 탈퇴 및 개인정보 삭제',
      description:
        '현재 비밀번호를 확인하고 계정 데이터를 삭제합니다. 예약 ID가 없는 미확정 알림은 먼저 결과 확인이 필요합니다(409). 알려진 Slack 예약의 취소 실패는 임시 작업으로 보관합니다.',
      security,
      requestBody: request(
        { password: { type: 'string', format: 'password', minLength: 1, maxLength: 200 } },
        ['password'],
      ),
      responses,
    },
  },
  '/account/sessions': {
    delete: {
      tags: ['Account'],
      summary: '다른 기기 세션 전체 해제',
      description: '현재 로그인 세션은 유지하고 같은 사용자의 다른 활성 세션을 모두 해제합니다.',
      security,
      responses,
    },
  },
  '/account/profile': {
    patch: {
      tags: ['Account'],
      summary: '닉네임 변경',
      description:
        '현재 이메일과 새 닉네임을 전달합니다. 이메일 변경은 새 주소 인증이 지원될 때까지 차단됩니다(409).',
      security,
      requestBody: request(
        {
          email: { type: 'string', format: 'email' },
          nickname: { type: 'string', minLength: 2, maxLength: 30 },
        },
        ['email', 'nickname'],
      ),
      responses,
    },
  },
  '/account/password': {
    patch: {
      tags: ['Account'],
      summary: '비밀번호 변경',
      description: '현재 비밀번호 검증 후 새 비밀번호를 저장하고 다른 기기의 세션을 해제합니다.',
      security,
      requestBody: request(
        {
          currentPassword: { type: 'string', format: 'password' },
          newPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 200 },
        },
        ['currentPassword', 'newPassword'],
      ),
      responses,
    },
  },
  '/account/slack': {
    get: {
      tags: ['Account'],
      summary: '본인 Slack 연결 상태',
      description:
        'configured, oauthConfigured, setupIssues, connected, workspaceId, memberId, connectedAt 반환. setupIssues는 설정 문제의 환경변수 이름이며 비밀 값·토큰은 반환하지 않습니다.',
      security,
      responses,
    },
    delete: {
      tags: ['Account'],
      summary: 'Slack 연결 해제',
      description:
        '활성/미확정 알림이 있으면 409. 서버 봇 설치나 기존 알림 기록을 삭제하지 않습니다.',
      security,
      responses,
    },
  },
  '/account/slack/challenge': {
    post: {
      tags: ['Account'],
      summary: '종료된 Slack 코드 인증 요청',
      deprecated: true,
      description:
        '로그인 검사 후 410을 반환합니다. DM 발송이나 연결 변경을 하지 않습니다. OAuth 시작 API를 사용하세요.',
      security,
      responses: {
        401: responses[401],
        410: { description: '코드 인증 종료' },
        429: responses[429],
      },
    },
  },
  '/account/slack/verify': {
    post: {
      tags: ['Account'],
      summary: '종료된 Slack 코드 검증',
      deprecated: true,
      description: '로그인 검사 후 410을 반환합니다. Slack 호출이나 연결 저장을 하지 않습니다.',
      security,
      responses: { 401: responses[401], 410: { description: '코드 인증 종료' } },
    },
  },
  '/account/slack/start': {
    post: {
      tags: ['Account'],
      summary: 'Slack OAuth 연결 시작',
      description:
        '기존 알림을 검사하고 세션에 귀속된 10분 유효 state를 생성합니다. 반환한 url로 같은 브라우저에서 이동하세요. 같은 IP에서 시간당 10회까지 허용합니다.',
      security,
      responses: {
        ...responses,
        200: {
          description: 'Slack 승인 URL',
          content: json({ type: 'object', properties: { url: { type: 'string', format: 'uri' } } }),
        },
      },
    },
  },
  '/account/slack/callback': {
    get: {
      tags: ['Account'],
      summary: 'Slack OAuth 콜백',
      description:
        '쿠키·로그인 세션·일회용 state를 대조하고 승인 코드를 교환합니다. 일반 워크스페이스 설치만 지원하며 Org 전체 설치·Token Rotation은 지원하지 않습니다. 결과 화면으로 이동합니다.',
      security,
      parameters: ['code', 'state', 'error'].map((name) => ({
        name,
        in: 'query',
        schema: { type: 'string' },
      })),
      responses: {
        303: { description: '/slack/callback 결과 화면으로 이동' },
        401: responses[401],
      },
    },
  },
  '/account/slack/test': {
    post: {
      tags: ['Account'],
      summary: '본인 Slack 연결에 테스트 DM 보내기',
      description:
        '연결된 워크스페이스·사용자·DM 경로를 확인하고 고정 테스트 메시지 한 건을 보냅니다. 수신자·본문을 요청에서 지정할 수 없습니다. 같은 IP에서 분당 3회까지 허용하며 자동 재시도하지 않습니다.',
      security,
      responses,
    },
  },
};
