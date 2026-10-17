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
test('complete agent lifecycle: spawn, ingest, delegate, telemetry, human review and approval', async () => {
  const spawned = await agentRoutes.POST(
    request('/actors/agents', 'POST', {
      handle: '@bot-integration',
      display_name: 'Integration agent',
      capabilities: ['testing'],
    }),
  );
  assert.equal(spawned.status, 200);
  const { actor, token } = await spawned.json();
  assert.ok(token.startsWith('nxs_'));
  assert.equal('api_key_hash' in actor, false);
  const body = { title: 'Integration lifecycle task', source_type: 'TICKET', source_ref: 'TEST-1' };
  const ingest = await ingestRoutes.POST(request('/ingest', 'POST', body));
  assert.equal(ingest.status, 200);
  const { task } = await ingest.json();
  const duplicate = await (await ingestRoutes.POST(request('/ingest', 'POST', body))).json();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.task.id, task.id);
  const handed = await delegationRoutes.POST(
    request(`/tasks/${task.id}/delegate`, 'POST', {
      target_handle: actor.handle,
      message: 'Please run verification',
    }),
    ctx(task.id),
  );
  assert.equal(handed.status, 200);
  assert.equal((await handed.json()).hop_count, 1);
  const telemetry = await telemetryRoutes.PATCH(
    request(
      `/tasks/${task.id}/telemetry`,
      'PATCH',
      {
        live_activity_text: 'Running integration suite',
        confidence_score: 0.97,
        tool_call: { name: 'test_runner', output: '12 checks passed' },
      },
      token,
    ),
    ctx(task.id),
  );
  assert.equal(telemetry.status, 200);
  assert.equal((await telemetry.json()).confidence_score, 0.97);
  const invalid = await telemetryRoutes.PATCH(
    request(`/tasks/${task.id}/telemetry`, 'PATCH', { confidence_score: 2 }, token),
    ctx(task.id),
  );
  assert.equal(invalid.status, 422);
  const denied = await taskRoutes.PATCH(
    request(`/tasks/${task.id}`, 'PATCH', { action: 'approve' }, token),
    ctx(task.id),
  );
  assert.equal(denied.status, 401);
  const workspace = await (
    await workspaceRoutes.GET(request('/workspace', 'GET', undefined, token))
  ).json();
  assert.deepEqual(
    workspace.tasks.map((t: { id: string }) => t.id),
    [task.id],
  );
  assert.ok(workspace.events.every((e: { task_id: string }) => e.task_id === task.id));
  assert.ok(workspace.actors.every((a: Record<string, unknown>) => !('api_key_hash' in a)));
  const ready = await telemetryRoutes.PATCH(
    request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'WAITING_HUMAN' }, token),
    ctx(task.id),
  );
  assert.equal(ready.status, 200);
  const approved = await taskRoutes.PATCH(
    request(`/tasks/${task.id}`, 'PATCH', { action: 'approve' }),
    ctx(task.id),
  );
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).state, 'DONE');
  const late = await telemetryRoutes.PATCH(
    request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'EXECUTING' }, token),
    ctx(task.id),
  );
  assert.equal(late.status, 409);
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
  const bad = await agentRoutes.POST(
    request('/actors/agents', 'POST', { handle: 'INVALID', display_name: 'Bad agent' }),
  );
  assert.equal(bad.status, 422);
  const unknown = await ingestRoutes.POST(
    request('/ingest', 'POST', {
      title: 'Bad payload',
      source_type: 'MANUAL',
      source_ref: 'TEST-2',
      admin: true,
    }),
  );
  assert.equal(unknown.status, 422);
  const unauthenticated = new NextRequest('http://localhost:3002/api/v1/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'No credentials', source_type: 'MANUAL', source_ref: 'TEST-3' }),
  });
  assert.equal((await ingestRoutes.POST(unauthenticated)).status, 401);
});
test('the API stops a looping chain on hop four, blocks telemetry, and allows a human reset', async () => {
  const created = await (
    await ingestRoutes.POST(
      request('/ingest', 'POST', {
        title: 'Circuit breaker integration',
        source_type: 'MANUAL',
        source_ref: 'TEST-LOOP',
      }),
    )
  ).json();
  let task = created.task;
  for (let hop = 1; hop <= 4; hop++) {
    const response = await delegationRoutes.POST(
      request(`/tasks/${task.id}/delegate`, 'POST', {
        target_handle: task.assignee_id === 'coder' ? '@bot-qa' : '@bot-coder',
      }),
      ctx(task.id),
    );
    assert.equal(response.status, 200);
    task = await response.json();
    assert.equal(task.hop_count, hop);
  }
  assert.equal(task.state, 'WAITING_HUMAN');
  const telemetry = await telemetryRoutes.PATCH(
    request(`/tasks/${task.id}/telemetry`, 'PATCH', { state: 'EXECUTING' }),
    ctx(task.id),
  );
  assert.equal(telemetry.status, 409);
  const extra = await delegationRoutes.POST(
    request(`/tasks/${task.id}/delegate`, 'POST', { target_handle: '@bot-qa' }),
    ctx(task.id),
  );
  assert.equal(extra.status, 409);
  const reset = await taskRoutes.PATCH(
    request(`/tasks/${task.id}`, 'PATCH', { action: 'resume' }),
    ctx(task.id),
  );
  assert.equal(reset.status, 200);
  const resumed = await reset.json();
  assert.equal(resumed.hop_count, 0);
  assert.equal(resumed.state, 'EXECUTING');
});
