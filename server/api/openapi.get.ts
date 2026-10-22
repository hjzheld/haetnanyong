import { openapi } from '#server/utils/openapi';

export default defineEventHandler(() => {
  const document = JSON.parse(JSON.stringify(openapi));
  document.paths['/calendar'].get.summary = '기간별 일정 조회';
  document.paths['/calendar'].get.description =
    '프로젝트 일정과 개인 일정만 반환합니다. 할 일과 보관된 프로젝트의 일정은 제외합니다. 최대 366일의 반열린 구간(from 포함, to 제외)을 지원하며 종일 일정도 KST 기준 실제 시간 구간과 겹치는지 확인합니다.';
  document.paths['/dashboard'].get.description =
    '다가오는 할 일(upcomingTasks)은 오늘부터 3일 이내, 지연된 할 일(overdueTasks)은 마감일이 지난 미완료 작업입니다. 보관된 프로젝트의 항목은 제외합니다.';
  const dashboardSchema =
    document.paths['/dashboard'].get.responses['200'].content['application/json'].schema;
  dashboardSchema.properties.overdueTasks = structuredClone(
    dashboardSchema.properties.upcomingTasks,
  );
  document.paths['/reminders/{id}/reconcile'] = {
    post: {
      tags: ['Reminders'],
      summary: 'Slack 예약 결과 재확인',
      description:
        '소유자만 호출할 수 있습니다. 처리 중인 요청은 2분간 기다립니다. Slack 전체 예약 목록을 대조하며 새 메시지를 발송하거나 자동 재예약하지 않습니다. 과거 시각의 ELAPSED는 수신 성공을 의미하지 않습니다. 이전 형식의 예약은 동일 시각의 메시지가 있으면 UNKNOWN으로 유지될 수 있습니다.',
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[1-9][0-9]*$' },
        },
      ],
      responses: {
        200: {
          description: '현재 또는 재확인된 상태',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  revision: { type: 'integer' },
                },
              },
            },
          },
        },
        401: { description: '로그인 필요' },
        404: { description: '본인 알림이 아니거나 존재하지 않음' },
        409: { description: '연결 정보 누락' },
        429: { description: 'Slack 요청 제한; Retry-After 확인' },
        502: { description: '예약 목록 조회 실패; 기존 상태 유지' },
      },
    },
  };
  const slackHealth = {
    get: {
      tags: ['Slack'],
      summary: '현재 로그인 사용자의 Slack 연결 인증 확인',
      description:
        'OAuth로 연결한 DM의 설치 토큰과 워크스페이스를 확인합니다. 메시지는 발송하지 않으며 실제 수신이나 기기 알림 설정은 검증하지 않습니다.',
      security: [{ sessionCookie: [] }],
      responses: {
        200: {
          description: '연결 인증 정상',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  service: { type: 'string' },
                  connected: { type: 'boolean' },
                },
              },
            },
          },
        },
        401: { description: '로그인 필요' },
        409: { description: '미연결 또는 워크스페이스 불일치' },
        502: { description: 'Slack 인증 실패' },
        503: { description: '서버 설정 누락' },
      },
    },
  };
  document.paths['/account/slack/health'] = slackHealth;
  document.paths['/health/slack'] = slackHealth;
  document.paths['/reminders'].post.description =
    '일정(eventId)에만 알림을 설정합니다. 일정/태스크 생성만으로는 알림을 발송하지 않습니다. 최소 1분 이후~120일 이내로 예약합니다. FAILED, ELAPSED, CANCELED 알림은 같은 일정에 재등록할 수 있습니다. 결과가 불확실하면 UNKNOWN으로 보존하고 상태 재확인 API를 사용합니다.';
  document.paths['/reminders'].post.responses['429'] = {
    description: 'Slack 요청 제한. Retry-After가 있으면 해당 초만큼 대기',
  };
  document.paths['/reminders/{id}'].delete.description =
    '미확정 결과는 먼저 재확인합니다. 2분 내 처리 중인 요청이나 식별할 수 없는 예약은 409로 보존합니다. 이미 삭제되거나 발송된 예약 ID는 취소 오류로 남기지 않습니다.';
  document.paths['/reminders'].post.requestBody.content[
    'application/json'
  ].schema.properties.text.maxLength = 4000;
  const color = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };
  for (const [name, defaultColor] of [
    ['Task', '#C98B8B'],
    ['Event', '#8E8AA3'],
  ] as const) {
    const schema = document.components.schemas[name];
    schema.properties.projectId.nullable = true;
    schema.properties.color = { ...color, default: defaultColor };
  }
  for (const [path, defaultColor] of [
    ['/tasks', '#C98B8B'],
    ['/events', '#8E8AA3'],
  ] as const) {
    for (const [route, method] of [
      [path, 'post'],
      [path + '/{id}', 'patch'],
    ] as const) {
      const schema =
        document.paths[route]?.[method]?.requestBody?.content?.['application/json']?.schema;
      if (!schema) continue;
      schema.properties.color =
        method === 'post' ? { ...color, default: defaultColor } : { ...color };
      if (schema.properties.projectId) schema.properties.projectId.nullable = true;
      if (schema.required)
        schema.required = schema.required.filter((field: string) => field !== 'projectId');
    }
  }
  for (const [resource, schema] of [
    ['tasks', 'Task'],
    ['events', 'Event'],
  ] as const) {
    document.paths['/' + resource].get.parameters = [
      {
        name: 'scope',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['standalone'] },
        description: 'Only items without a project when set to standalone.',
      },
    ];
    document.paths['/' + resource + '/{id}'].get = {
      tags: [resource === 'tasks' ? 'Tasks' : 'Events'],
      summary: 'Get an owned item',
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[1-9][0-9]*$' },
        },
      ],
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/' + schema } } },
        },
        '404': { description: 'Item not found' },
      },
    };
  }
  return document;
});
