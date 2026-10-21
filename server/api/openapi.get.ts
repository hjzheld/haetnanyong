import { openapi } from '#server/utils/openapi';

export default defineEventHandler(() => {
  const document = JSON.parse(JSON.stringify(openapi));
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
