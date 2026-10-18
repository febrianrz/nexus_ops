import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

let directory: string;
let patch: typeof import('../app/api/v1/tasks/[id]/route').PATCH;
let transact: typeof import('../lib/store').transact;
const token = 'task-status-test-token';
const context = { params: Promise.resolve({ id: 'NEX-104' }) };
function request(body: unknown, authenticated = true) {
  return new NextRequest('http://localhost/api/v1/tasks/NEX-104', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nexus-status-test-'));
  process.env.NEXUS_DATA_DIR = directory;
  process.env.NEXUS_DEMO_MODE = 'true';
  process.env.NEXUS_ADMIN_TOKEN = token;
  delete process.env.DATABASE_URL;
  patch = (await import('../app/api/v1/tasks/[id]/route')).PATCH;
  transact = (await import('../lib/store')).transact;
});
after(async () => { await rm(directory, { recursive: true, force: true }); });
test('human status changes persist all four statuses and release worker claims', async () => {
  for (const state of ['TRIAGE', 'EXECUTING', 'WAITING_HUMAN', 'DONE']) {
    await transact((workspace) => { workspace.tasks.find((task) => task.id === 'NEX-104')!.lock_token = 'old-claim'; });
    const response = await patch(request({ action: 'set-status', state }), context);
    assert.equal(response.status, 200);
    await transact((workspace) => {
      const task = workspace.tasks.find((item) => item.id === 'NEX-104')!;
      assert.equal(task.state, state);
      assert.equal(task.lock_token, null);
      assert.ok(workspace.events.some((event) => event.task_id === task.id && event.event_type === 'STATE_CHANGE' && event.structured_payload.state === state));
    });
  }
});
test('missing, unsupported, and unauthenticated status changes are rejected', async () => {
  assert.equal((await patch(request({ action: 'set-status' }), context)).status, 422);
  assert.equal((await patch(request({ action: 'set-status', state: 'INVALID' }), context)).status, 422);
  assert.equal((await patch(request({ action: 'set-status', state: 'TRIAGE' }, false), context)).status, 401);
  await transact((workspace) => assert.equal(workspace.tasks.find((task) => task.id === 'NEX-104')!.state, 'DONE'));
});

test('priority selections and clearing persist without changing task status', async () => {
  for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']) {
    const response = await patch(request({ action: 'set-priority', priority }), context);
    assert.equal(response.status, 200);
    await transact((workspace) => {
      const task = workspace.tasks.find((item) => item.id === 'NEX-104')!;
      assert.equal(task.priority, priority);
      assert.equal(task.state, 'DONE');
    });
  }
  for (const priority of ['URGENT', null, 1]) assert.equal((await patch(request({ action: 'set-priority', priority }), context)).status, 422);
  assert.equal((await patch(request({ action: 'set-priority', priority: 'HIGH' }, false), context)).status, 401);
});
