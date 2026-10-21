const security = [{ sessionCookie: [] }];
const json = (schema: object) => ({ 'application/json': { schema } });
const request = (properties: Record<string, object>, required: string[]) => ({
  required: true,
  content: json({ type: 'object', properties, required }),
});
const responses = {
  200: { description: '성공', content: json({ type: 'object' }) },
  400: { description: '입력값·현재 비밀번호·인증 코드 오류' },
  401: { description: '로그인 필요' },
  409: { description: '중복 이메일/닉네임 또는 활성 알림으로 연결 변경 불가' },
  429: { description: '인증 코드 재발송 대기' },
  502: { description: 'Slack 인증/권한/호출 오류' },
  503: { description: '서버 Slack 설정 누락' },
};
export const accountPaths = {
  '/account': {
    delete: {
      tags: ['Account'],
      summary: '회원 탈퇴 및 개인정보 삭제',
      description:
        '현재 비밀번호를 확인하고 계정 데이터를 삭제합니다. Slack 예약 취소가 확인되지 않으면 개인정보를 제외한 채널 ID와 예약 메시지 ID만 임시 취소 작업으로 보관합니다.',
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
      summary: '이메일·닉네임 변경',
      description: '이메일 변경 시 현재 비밀번호가 필요하며 다른 기기의 세션을 해제합니다.',
      security,
      requestBody: request(
        {
          email: { type: 'string', format: 'email' },
          nickname: { type: 'string', minLength: 2, maxLength: 30 },
          currentPassword: { type: 'string', format: 'password' },
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
        'configured, connected, workspaceId, memberId, connectedAt 반환. 봇 토큰은 반환하지 않습니다.',
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
      summary: 'Slack 연결 인증 코드 DM 보내기',
      description:
        '서버 봇과 같은 워크스페이스의 활성 멤버에게 실제 인증 DM 1건을 보냅니다. memberId는 U/W로 시작. 코드는 10분 유효, 현재 로그인 세션에 귀속되며 1분 재발송 대기. HttpOnly 인증 쿠키를 같은 브라우저에서 verify에 전송해야 합니다. 봇 권한 users:read, im:write, chat:write 필요.',
      security,
      requestBody: request(
        { memberId: { type: 'string', pattern: '^[UW][A-Z0-9]{8,49}$', example: 'U0123456789' } },
        ['memberId'],
      ),
      responses,
    },
  },
  '/account/slack/verify': {
    post: {
      tags: ['Account'],
      summary: 'DM 인증 코드를 검증하고 Slack 연결 저장',
      description:
        '12자리 코드를 검증한 후 users의 네 Slack 연결 필드를 함께 저장합니다. DM 채널과 워크스페이스 ID를 직접 입력받지 않습니다.',
      security,
      requestBody: request(
        { code: { type: 'string', minLength: 12, maxLength: 12, example: 'A1B2C3D4E5F6' } },
        ['code'],
      ),
      responses,
    },
  },
};
