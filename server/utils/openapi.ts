import { accountPaths } from '#server/utils/account-openapi';
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Nyang API',
    version: '1.4.0',
    description:
      '현재 백엔드 및 제공된 Neon 스키마 기준. BIGINT ID는 정밀도 보존을 위해 문자열 사용 권장. session HttpOnly 쿠키로 인증하며 로그인 후 Try it out 요청에 자동 전송됩니다. DB 제약조건 오류는 400, 중복은 409입니다.',
  },
  servers: [
    {
      url: '/api',
    },
  ],
  tags: [
    { name: 'Account' },
    {
      name: 'Health',
    },
    {
      name: 'Auth',
    },
    {
      name: 'Projects',
    },
    {
      name: 'Tasks',
    },
    {
      name: 'Events',
    },
    {
      name: 'Calendar',
    },
    {
      name: 'Dashboard',
    },
    {
      name: 'Reminders',
    },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            pattern: '^[1-9][0-9]*$',
            example: '4',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          nickname: {
            type: 'string',
          },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
            maxLength: 150,
          },
          description: {
            type: 'string',
            nullable: true,
          },
          color: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            example: '#557558',
          },
          archivedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          projectId: {
            type: 'string',
          },
          title: {
            type: 'string',
            maxLength: 200,
          },
          description: {
            type: 'string',
            nullable: true,
          },
          startDate: {
            type: 'string',
            format: 'date',
          },
          dueDate: {
            type: 'string',
            format: 'date',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH'],
          },
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'DONE'],
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          projectId: {
            type: 'string',
          },
          title: {
            type: 'string',
            maxLength: 200,
          },
          description: {
            type: 'string',
            nullable: true,
          },
          allDay: {
            type: 'boolean',
            default: false,
          },
          startsAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          endsAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          startDate: {
            type: 'string',
            format: 'date',
            nullable: true,
          },
          endDate: {
            type: 'string',
            format: 'date',
            nullable: true,
            description: 'Exclusive end date; must follow startDate',
          },
        },
      },
      Reminder: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          eventId: {
            type: 'string',
          },
          timingType: {
            type: 'string',
            enum: ['BEFORE_START', 'CUSTOM'],
          },
          offsetMinutes: {
            type: 'integer',
            nullable: true,
          },
          remindAt: {
            type: 'string',
            format: 'date-time',
          },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'SCHEDULING',
              'SCHEDULED',
              'FAILED',
              'UNKNOWN',
              'CANCEL_PENDING',
              'CANCELED',
              'CANCEL_FAILED',
              'ELAPSED',
            ],
          },
          revision: {
            type: 'integer',
          },
          slackScheduledMessageId: {
            type: 'string',
            nullable: true,
          },
          errorMessage: {
            type: 'string',
            nullable: true,
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          statusCode: {
            type: 'integer',
          },
          statusMessage: {
            type: 'string',
          },
          message: {
            type: 'string',
          },
          data: {
            type: 'object',
          },
        },
      },
    },
  },
  paths: {
    ...accountPaths,
    '/workspace': {
      get: {
        tags: ['Dashboard'],
        summary: '작업 화면 통합 조회',
        description: '프로젝트·할 일·일정·리마인더를 동일한 사용자 인증으로 병렬 조회합니다.',
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
                    tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                    events: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                    reminders: { type: 'array', items: { $ref: '#/components/schemas/Reminder' } },
                  },
                },
              },
            },
          },
          401: { description: 'Missing, expired or revoked session' },
        },
      },
    },
    '/items': {
      get: {
        tags: ['Tasks', 'Events'],
        summary: '프로젝트 없는 할 일·일정 통합 조회',
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: 'scope',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['standalone'] },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                    events: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid scope' },
          401: { description: 'Missing, expired or revoked session' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: '서버 상태',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                    service: {
                      type: 'string',
                    },
                    timezone: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/health/db': {
      get: {
        tags: ['Health'],
        summary: 'Neon 연결 상태',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                    database: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/health/slack': {
      get: {
        tags: ['Health'],
        summary: 'Slack 인증 상태',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                    service: {
                      type: 'string',
                    },
                    team: {
                      type: 'string',
                    },
                    user: {
                      type: 'string',
                    },
                    botId: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: '회원가입 및 자동 로그인',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      $ref: '#/components/schemas/User',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                  },
                  nickname: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 30,
                    description: '선택; 생략 또는 공백이면 DB 랜덤 닉네임 기본값 사용',
                  },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: '이메일 로그인',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      $ref: '#/components/schemas/User',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                  },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: '세션 폐기 및 쿠키 삭제',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: '현재 사용자',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      $ref: '#/components/schemas/User',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
    },
    '/projects': {
      get: {
        tags: ['Projects'],
        summary: '목록 조회',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Project',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
      post: {
        tags: ['Projects'],
        summary: '프로젝트 생성',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 150,
                  },
                  description: {
                    type: 'string',
                  },
                  color: {
                    type: 'string',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    example: '#557558',
                  },
                },
                required: ['name'],
              },
            },
          },
        },
      },
    },
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: '목록 조회',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Task',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
      post: {
        tags: ['Tasks'],
        summary: '할 일 생성',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Task',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'startDate ≤ dueDate. priority 기본값 MEDIUM. 보관되지 않은 본인 프로젝트만 허용.',
        security: [
          {
            sessionCookie: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectId: {
                    type: 'string',
                    pattern: '^[1-9][0-9]*$',
                    example: '4',
                  },
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                  },
                  startDate: {
                    type: 'string',
                    format: 'date',
                  },
                  dueDate: {
                    type: 'string',
                    format: 'date',
                  },
                  priority: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH'],
                  },
                },
                required: ['projectId', 'title', 'startDate', 'dueDate'],
              },
            },
          },
        },
      },
    },
    '/events': {
      get: {
        tags: ['Events'],
        summary: '목록 조회',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Event',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
      post: {
        tags: ['Events'],
        summary: '이벤트 생성',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Event',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'allDay=false(기본): startsAt/endsAt 필수, 시간대 포함 ISO8601. allDay=true: startDate/endDate 필수. 종료 > 시작.',
        security: [
          {
            sessionCookie: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectId: {
                    type: 'string',
                    pattern: '^[1-9][0-9]*$',
                    example: '4',
                  },
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                  },
                  allDay: {
                    type: 'boolean',
                    default: false,
                  },
                  startsAt: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-12-01T14:00:00+09:00',
                  },
                  endsAt: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-12-01T15:00:00+09:00',
                  },
                  startDate: {
                    type: 'string',
                    format: 'date',
                  },
                  endDate: {
                    type: 'string',
                    format: 'date',
                  },
                },
                required: ['projectId', 'title'],
              },
            },
          },
        },
      },
    },
    '/reminders': {
      get: {
        tags: ['Reminders'],
        summary: '목록 조회',
        parameters: [
          {
            name: 'eventId',
            in: 'query',
            required: false,
            description: '현재 사용자의 특정 일정 알림만 조회',
            schema: { type: 'string', pattern: '^[1-9][0-9]*$' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Reminder',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
      post: {
        tags: ['Reminders'],
        summary: 'Slack 예약 메시지 생성',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                    },
                    eventId: {
                      type: 'string',
                    },
                    remindAt: {
                      type: 'string',
                      format: 'date-time',
                    },
                    status: {
                      type: 'string',
                    },
                    revision: {
                      type: 'integer',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'scheduledAt 지정 시 CUSTOM, offsetMinutes 동시 지정 금지. 생략 시 시간 이벤트 시작 10/30분 전(BEFORE_START). 종일 이벤트는 scheduledAt 필수. 최소 1분 이후부터 120일 이내. CANCELED, FAILED, ELAPSED 상태는 재예약 가능하며, 예약 시각이 지난 SCHEDULED는 Slack 예약 목록과 대조한 뒤 처리합니다. text는 본문만 전달하고 서버가 고정 머리말을 붙이며 전체 메시지는 4,000자 이내입니다. 불명확한 결과는 UNKNOWN으로 보존.',
        security: [
          {
            sessionCookie: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: {
                    type: 'string',
                    pattern: '^[1-9][0-9]*$',
                    example: '4',
                  },
                  text: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 3983,
                    description:
                      '알림 본문. 서버가 고정 머리말 :paw_prints: 했냐옹과 줄바꿈을 추가합니다.',
                  },
                  scheduledAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                  offsetMinutes: {
                    type: 'integer',
                    enum: [10, 30],
                    default: 10,
                  },
                },
                required: ['eventId', 'text'],
              },
            },
          },
        },
      },
    },
    '/projects/{id}': {
      patch: {
        tags: ['Projects'],
        summary: '프로젝트 수정·보관·복원',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 150,
                  },
                  description: {
                    type: 'string',
                  },
                  color: {
                    type: 'string',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    example: '#557558',
                  },
                  archived: {
                    type: 'boolean',
                  },
                  onlyIfComplete: {
                    type: 'boolean',
                    description:
                      'archived=true와 함께 사용. 비어 있지 않고 모든 할 일 완료·모든 일정 종료 조건을 UPDATE 시점에 검사하며 불충족 시 409 반환.',
                  },
                },
                minProperties: 1,
              },
            },
          },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: '프로젝트 보관 처리',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
      },
    },
    '/tasks/{id}': {
      patch: {
        tags: ['Tasks'],
        summary: '할 일 수정·완료 상태 변경',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Task',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                  },
                  startDate: {
                    type: 'string',
                    format: 'date',
                  },
                  dueDate: {
                    type: 'string',
                    format: 'date',
                  },
                  priority: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH'],
                  },
                  status: {
                    type: 'string',
                    enum: ['TODO', 'IN_PROGRESS', 'DONE'],
                  },
                },
                minProperties: 1,
              },
            },
          },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: '할 일 삭제',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
      },
    },
    '/events/{id}': {
      patch: {
        tags: ['Events'],
        summary: '이벤트 수정',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Event',
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          '이벤트 종류 변경은 지원하지 않습니다. 활성/결과 미확인 리마인더가 있으면 먼저 취소/확인해야 하며 409를 반환합니다.',
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                  },
                  startsAt: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-12-01T14:00:00+09:00',
                  },
                  endsAt: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-12-01T15:00:00+09:00',
                  },
                  startDate: {
                    type: 'string',
                    format: 'date',
                  },
                  endDate: {
                    type: 'string',
                    format: 'date',
                  },
                },
                minProperties: 1,
              },
            },
          },
        },
      },
      delete: {
        tags: ['Events'],
        summary: '예약 취소 후 이벤트 삭제',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          '연결 Slack 예약을 취소하고 DB 이벤트를 삭제합니다. 취소 실패 또는 예약 결과 미확인 시 삭제하지 않습니다.',
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
      },
    },
    '/calendar': {
      get: {
        tags: ['Calendar'],
        summary: '기간별 일정 목록',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'from',
            in: 'query',
            schema: {
              type: 'string',
              format: 'date-time',
            },
          },
          {
            name: 'to',
            in: 'query',
            schema: {
              type: 'string',
              format: 'date-time',
            },
          },
        ],
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
    },
    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: '대시보드 요약',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    todayEvents: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                    upcomingTasks: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                    completion: {
                      type: 'object',
                      properties: {
                        total: {
                          type: 'integer',
                        },
                        completed: {
                          type: 'integer',
                        },
                        rate: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
      },
    },
    '/reminders/{id}': {
      delete: {
        tags: ['Reminders'],
        summary: '저장된 채널로 Slack 예약 취소',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing or invalid input / database constraint',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Missing, expired or revoked session',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found or not owned',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate value or incompatible reservation state',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '502': {
            description: 'Slack request failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Database or Slack configuration unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        security: [
          {
            sessionCookie: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              pattern: '^[1-9][0-9]*$',
              example: '4',
            },
          },
        ],
      },
    },
  },
} as const;
