import { NextResponse } from 'next/server';

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'NexusOps API',
    version: '1.0.0',
    description: 'REST API for workspace tasks and external AI workers. AI execution stays in your own application; NexusOps provides task routing, agent labels, and worker telemetry.',
  },
  servers: [{ url: '/api/v1', description: 'NexusOps API' }],
  tags: [
    { name: 'Worker', description: 'Claim work for an AI agent and report progress.' },
    { name: 'Tasks', description: 'Read task data and update worker-owned task telemetry.' },
    { name: 'Workspace', description: 'Read workspace projects, tasks, members, and agent labels.' },
  ],
  components: {
    securitySchemes: { apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'nxo_…' } },
    schemas: {
      Task: { type: 'object', required: ['id', 'title', 'state', 'project_id'], properties: { id: { type: 'string' }, project_id: { type: 'string', nullable: true }, parent_task_id: { type: 'string', nullable: true }, title: { type: 'string' }, description: { type: 'string' }, state: { type: 'string', enum: ['TRIAGE', 'QUEUED', 'EXECUTING', 'WAITING_HUMAN', 'BLOCKED', 'DONE'] }, priority: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, assignee_id: { type: 'string', nullable: true }, agent_key: { type: 'string', nullable: true }, lock_token: { type: 'string', nullable: true }, confidence_score: { type: 'number', nullable: true }, live_activity_text: { type: 'string', nullable: true }, context_payload: { type: 'object', additionalProperties: true } } },
      Error: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
  paths: {
    '/agent/tasks': {
      get: { tags: ['Worker'], summary: 'Claim queued tasks for an agent', security: [{ apiKey: [] }], parameters: [{ name: 'project_id', in: 'query', required: true, schema: { type: 'string' } }, { name: 'agent_key', in: 'query', required: true, schema: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,39}$' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 1 } }], responses: { '200': { description: 'Tasks atomically claimed by this worker.' }, '401': { description: 'Invalid, expired, or missing API key.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } }, '404': { description: 'Project is outside the API key workspace.' } } },
    },
    '/tasks/{taskId}/telemetry': {
      patch: { tags: ['Tasks'], summary: 'Report worker progress', security: [{ apiKey: [] }], parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['lock_token'], properties: { lock_token: { type: 'string' }, state: { type: 'string', enum: ['EXECUTING', 'WAITING_HUMAN', 'DONE'] }, live_activity_text: { type: 'string', maxLength: 500 }, confidence_score: { type: 'number', minimum: 0, maximum: 1 }, tool_call: { type: 'object', additionalProperties: true } } } } } }, responses: { '200': { description: 'Telemetry accepted.' }, '409': { description: 'Task lock is stale or task is already complete.' } } },
    },
    '/workspace': {
      get: { tags: ['Workspace'], summary: 'Read the workspace task graph', security: [{ apiKey: [] }], responses: { '200': { description: 'Workspace projects, tasks, events, and actors.' }, '401': { description: 'Authentication required.' } } },
    },
    '/agents': {
      get: { tags: ['Workspace'], summary: 'List AI agent labels', security: [{ apiKey: [] }], responses: { '200': { description: 'Active agent labels in the API key workspace.' } } },
      post: { tags: ['Workspace'], summary: 'Create, update, or remove an AI agent label', security: [{ apiKey: [] }], requestBody: { required: true, content: { 'application/json': { schema: { oneOf: [{ type: 'object', required: ['action', 'name', 'username'], properties: { action: { const: 'create' }, name: { type: 'string' }, username: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,39}$' }, avatar_url: { type: 'string', nullable: true, description: 'Optional data URL for PNG, JPEG, WebP, or GIF, max 1 MB.' } } }, { type: 'object', required: ['action', 'id', 'name', 'username'], properties: { action: { const: 'update' }, id: { type: 'string' }, name: { type: 'string' }, username: { type: 'string' }, avatar_url: { type: 'string', nullable: true } } }, { type: 'object', required: ['action', 'id'], properties: { action: { const: 'delete' }, id: { type: 'string' } } }] } } } }, responses: { '200': { description: 'Agent updated or removed.' }, '201': { description: 'Agent created.' }, '403': { description: 'API key creator no longer has workspace admin access.' }, '409': { description: 'Username already exists.' } } },
    },
    '/projects': {
      get: { tags: ['Workspace'], summary: 'List workspace projects', security: [{ apiKey: [] }], responses: { '200': { description: 'Projects visible in the workspace.' } } },
      post: { tags: ['Workspace'], summary: 'Create a project (admin session)', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 120 } } } } } }, responses: { '201': { description: 'Project created.' } } },
    },
    '/ingest': {
      post: { tags: ['Tasks'], summary: 'Create or ingest a task (admin session or signed webhook)', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'source_type', 'source_ref', 'project_id'], properties: { title: { type: 'string' }, description: { type: 'string' }, source_type: { type: 'string', enum: ['MANUAL', 'TICKET', 'GITHUB_ISSUE', 'GITHUB_PR'] }, source_ref: { type: 'string' }, project_id: { type: 'string' }, parent_task_id: { type: 'string', nullable: true }, is_agent_task: { type: 'boolean' }, agent_key: { type: 'string', nullable: true } } } } } }, responses: { '200': { description: 'Task created or existing task returned.' } } },
    },
  },
} as const;

export function GET() {
  return NextResponse.json(openapi, { headers: { 'Cache-Control': 'no-store' } });
}
