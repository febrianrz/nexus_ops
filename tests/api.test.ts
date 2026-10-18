import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
let temporaryDirectory: string;
let agentRoutes: typeof import('../app/api/v1/actors/agents/route');
let ingestRoutes: typeof import('../app/api/v1/ingest/route');
let delegationRoutes: typeof import('../app/api/v1/tasks/[id]/delegate/route');
let telemetryRoutes: typeof import('../app/api/v1/tasks/[id]/telemetry/route');
let taskRoutes: typeof import('../app/api/v1/tasks/[id]/route');
let workerRoutes: typeof import('../app/api/v1/agent/tasks/route');
let workspaceRoutes: typeof import('../app/api/v1/workspace/route');
const adminToken = 'integration-test-admin-token';
function request(path: string, method: string, body?: unknown, token = adminToken) {
  return new NextRequest(`http://localhost:3002/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'nexus-api-test-'));
  process.env.NEXUS_DATA_DIR = temporaryDirectory;
  delete process.env.DATABASE_URL;
  process.env.NEXUS_DEMO_MODE = 'true';
  process.env.NEXUS_ADMIN_TOKEN = adminToken;
  process.env.NEXUS_WEBHOOK_SECRET = 'integration-test-webhook-secret';
  workerRoutes = await import('../app/api/v1/agent/tasks/route');
  process.env.NEXUS_WORKER_TOKEN = adminToken;
  agentRoutes = await import('../app/api/v1/actors/agents/route');
  ingestRoutes = await import('../app/api/v1/ingest/route');
  delegationRoutes = await import('../app/api/v1/tasks/[id]/delegate/route');
  telemetryRoutes = await import('../app/api/v1/tasks/[id]/telemetry/route');
  taskRoutes = await import('../app/api/v1/tasks/[id]/route');
  workspaceRoutes = await import('../app/api/v1/workspace/route');
});
after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});
test('external worker claims queued tasks, reports testing readiness, and a human completes the task', async () => {
  const body = { title: 'External worker lifecycle', source_type: 'MANUAL', source_ref: 'worker-lifecycle', project_id: 'demo-project', is_agent_task: true, agent_key: 'backend' };
  const ingested = await ingestRoutes.POST(request('/ingest', 'POST', body));
  assert.equal(ingested.status, 200);
  const task = (await ingested.json()).task;
  const duplicate = await (await ingestRoutes.POST(request('/ingest', 'POST', body))).json();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.task.id, task.id);
  const claimed = await workerRoutes.GET(request('/agent/tasks?project_id=demo-project&agent_key=backend', 'GET'));
  assert.equal(claimed.status, 200);
  const workerTask = (await claimed.json()).tasks.find((item: { id: string }) => item.id === task.id);
  assert.equal(workerTask.state, 'EXECUTING');
  assert.ok(workerTask.lock_token);
  const telemetry = await telemetryRoutes.PATCH(request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'WAITING_HUMAN', confidence_score: .97, lock_token: workerTask.lock_token, tool_call: { name: 'test_runner', output: 'Checks passed' } }), ctx(task.id));
  assert.equal(telemetry.status, 200);
  assert.equal((await telemetry.json()).state, 'WAITING_HUMAN');
  const approval = await taskRoutes.PATCH(request(`/tasks/${task.id}`, 'PATCH', { action: 'approve' }), ctx(task.id));
  assert.equal(approval.status, 200);
  assert.equal((await approval.json()).state, 'DONE');
  assert.equal((await telemetryRoutes.PATCH(request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'EXECUTING', lock_token: workerTask.lock_token }), ctx(task.id))).status, 409);
});
test('webhook signatures are verified against the raw body and GitHub payloads normalize', async () => {
  const raw = JSON.stringify({
    action: 'opened',
    repository: { full_name: 'nexus/test' },
    pull_request: {
      number: 42,
      title: 'Signed GitHub pull request',
      body: 'Review this change',
      html_url: 'https://github.com/nexus/test/pull/42',
      head: { ref: 'feat/example' },
      labels: [{ name: 'backend' }],
    },
  });
  const signature =
    'sha256=' + createHmac('sha256', process.env.NEXUS_WEBHOOK_SECRET!).update(raw).digest('hex');
  const req = new NextRequest('http://localhost:3002/api/v1/ingest', {
    method: 'POST',
    headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': signature },
    body: raw,
  });
  const result = await ingestRoutes.POST(req);
  assert.equal(result.status, 200);
  const { task } = await result.json();
  assert.equal(task.source_type, 'GITHUB_PR');
  assert.equal(task.source_ref, 'nexus/test#42');
  assert.equal(task.context_payload.branch, 'feat/example');
  const bad = new NextRequest('http://localhost:3002/api/v1/ingest', {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=invalid' },
    body: raw,
  });
  assert.equal((await ingestRoutes.POST(bad)).status, 401);
});
test('untrusted input and unauthorized mutations fail at the API boundary', async () => {
  const invalid = await ingestRoutes.POST(request('/ingest', 'POST', { title: 'Bad payload', source_type: 'MANUAL', source_ref: 'invalid', admin: true }));
  assert.equal(invalid.status, 422);
  const req = new NextRequest('http://localhost:3002/api/v1/ingest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Missing credentials', source_type: 'MANUAL', source_ref: 'denied' }) });
  assert.equal((await ingestRoutes.POST(req)).status, 401);
  assert.equal((await workerRoutes.GET(request('/agent/tasks?project_id=demo-project&agent_key=backend', 'GET', undefined, 'invalid-token'))).status, 401);
  assert.equal((await workerRoutes.GET(request('/agent/tasks', 'GET'))).status, 422);
});
test('retired agent registration and delegation APIs return Gone', async () => {
  assert.equal((await agentRoutes.POST(request('/actors/agents', 'POST', { handle: '@old-agent' }))).status, 410);
  assert.equal((await delegationRoutes.POST(request('/tasks/NEX-104/delegate', 'POST', { target_handle: '@old-agent' }), ctx('NEX-104'))).status, 410);
});
test('concurrent worker claims cannot claim the same task twice and old locks cannot update a reset task', async () => {
  const response = await ingestRoutes.POST(request('/ingest', 'POST', { title: 'Concurrent claims', source_type: 'MANUAL', source_ref: 'concurrent-worker', project_id: 'demo-project', is_agent_task: true, agent_key: 'qa' }));
  const task = (await response.json()).task;
  const results = await Promise.all([workerRoutes.GET(request('/agent/tasks?project_id=demo-project&agent_key=qa', 'GET')), workerRoutes.GET(request('/agent/tasks?project_id=demo-project&agent_key=qa', 'GET'))]);
  const claims = (await Promise.all(results.map((result) => result.json()))).flatMap((result) => result.tasks).filter((item) => item.id === task.id);
  assert.equal(claims.length, 1);
  assert.equal((await taskRoutes.PATCH(request(`/tasks/${task.id}`, 'PATCH', { action: 'queue' }), ctx(task.id))).status, 200);
  assert.equal((await telemetryRoutes.PATCH(request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'EXECUTING', lock_token: claims[0].lock_token }), ctx(task.id))).status, 409);
});
