import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';
import { taskCompletion } from '../lib/task-planning';
import type { Task } from '../lib/types';

let directory: string;
let patch: typeof import('../app/api/v1/tasks/[id]/route').PATCH;
let ingest: typeof import('../app/api/v1/ingest/route').POST;
let transact: typeof import('../lib/store').transact;
const token = 'planning-test-token';
const context = { params: Promise.resolve({ id: 'NEX-104' }) };
function request(body: unknown, authenticated = true) {
  return new NextRequest('http://localhost/api/v1/tasks/NEX-104', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nexus-planning-'));
  process.env.NEXUS_DATA_DIR = directory;
  process.env.NEXUS_DEMO_MODE = 'true';
  process.env.NEXUS_ADMIN_TOKEN = token;
  delete process.env.DATABASE_URL;
  patch = (await import('../app/api/v1/tasks/[id]/route')).PATCH;
  ingest = (await import('../app/api/v1/ingest/route')).POST;
  transact = (await import('../lib/store')).transact;
});
after(async () => { await rm(directory, { recursive: true, force: true }); });
test('planning edits persist, preserve metadata and status, validate partial dates, and support clearing', async () => {
  const before = await transact((workspace) => workspace.tasks.find((task) => task.id === 'NEX-104')!);
  const response = await patch(request({ action: 'update-planning', start_date: '2026-10-18', due_date: '2026-10-22', completion: 45 }), context);
  assert.equal(response.status, 200);
  await transact((workspace) => {
    const task = workspace.tasks.find((item) => item.id === 'NEX-104')!;
    assert.equal(task.state, before.state);
    assert.deepEqual(task.context_payload, { ...before.context_payload, start_date: '2026-10-18', due_date: '2026-10-22', completion: 45 });
    assert.equal(taskCompletion(task, workspace.tasks), 45);
  });
  for (const values of [{ due_date: '2026-10-01' }, { start_date: '2026-02-30' }, { completion: -1 }, { completion: 101 }, { completion: 4.5 }, { completion: '50' }]) {
    assert.equal((await patch(request({ action: 'update-planning', ...values }), context)).status, 422);
  }
  assert.equal((await patch(request({ action: 'update-planning', due_date: null, start_date: null, completion: null }), context)).status, 200);
  await transact((workspace) => assert.equal(workspace.tasks.find((task) => task.id === 'NEX-104')!.context_payload.due_date, null));
});
test('parents roll up lowest-level progress, done overrides manual values, and direct parent edits are rejected', async () => {
  await transact((workspace) => {
    const parent = workspace.tasks.find((task) => task.id === 'NEX-104')!;
    const child = { ...parent, id: 'planning-child', parent_task_id: parent.id, context_payload: { completion: 20 } } as Task;
    const grandchild = { ...parent, id: 'planning-grandchild', parent_task_id: child.id, context_payload: { completion: 60 } } as Task;
    const sibling = { ...parent, id: 'planning-sibling', parent_task_id: parent.id, state: 'DONE', context_payload: { completion: 10 } } as Task;
    workspace.tasks.push(child, grandchild, sibling);
    assert.equal(taskCompletion(parent, workspace.tasks), 80);
    assert.equal(taskCompletion(child, workspace.tasks), 60);
    assert.equal(taskCompletion(sibling, workspace.tasks), 100);
  });
  assert.equal((await patch(request({ action: 'update-planning', completion: 70 }), context)).status, 422);
  assert.equal((await patch(request({ action: 'update-planning', due_date: '2026-11-01' }), context)).status, 200);
  assert.equal((await patch(request({ action: 'update-planning', completion: 10 }, false), context)).status, 401);
});
test('task creation validates planning metadata at the API boundary', async () => {
  const base = { title: 'Planning test task', source_type: 'MANUAL', source_ref: 'planning-creation', project_id: 'demo-project' };
  assert.equal((await ingest(request({ ...base, context_payload: { start_date: '2026-11-02', due_date: '2026-11-01' } }))).status, 422);
  assert.equal((await ingest(request({ ...base, context_payload: { completion: 150 } }))).status, 422);
  const response = await ingest(request({ ...base, context_payload: { start_date: '2026-11-01', due_date: '2026-11-02', completion: 25 } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).task.context_payload.completion, 25);
});
