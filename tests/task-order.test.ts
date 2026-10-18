import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';
import { sortTasks } from '../lib/task-order';
import type { Task } from '../lib/types';

let directory: string;
let patch: typeof import('../app/api/v1/tasks/[id]/route').PATCH;
let transact: typeof import('../lib/store').transact;
const token = 'task-order-test';
async function move(id: string, target: string, placement: 'before' | 'after', authenticated = true) {
  return patch(new NextRequest(`http://localhost/api/v1/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'reorder', target_id: target, placement }) }), { params: Promise.resolve({ id }) });
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nexus-order-'));
  process.env.NEXUS_DATA_DIR = directory;
  process.env.NEXUS_DEMO_MODE = 'true';
  process.env.NEXUS_ADMIN_TOKEN = token;
  delete process.env.DATABASE_URL;
  patch = (await import('../app/api/v1/tasks/[id]/route')).PATCH;
  transact = (await import('../lib/store')).transact;
  await transact((workspace) => {
    const template = workspace.tasks[0];
    workspace.tasks = [
      ['root-a', null], ['root-b', null], ['root-c', null],
      ['child-a', 'root-a'], ['child-b', 'root-a'],
      ['grand-a', 'child-a'], ['grand-b', 'child-a'],
    ].map(([id, parent]) => ({ ...template, id, parent_task_id: parent, state: 'TRIAGE', context_payload: { description: 'preserved' }, created_at: '2026-10-18T00:00:00Z' }) as Task);
    workspace.tasks.push({ ...workspace.tasks[0], id: 'foreign', project_id: 'another-project' }, { ...workspace.tasks[0], id: 'done-root', state: 'DONE' });
  });
});
after(async () => { await rm(directory, { recursive: true, force: true }); });
test('reorders each of three levels and preserves hierarchy and metadata after reread', async () => {
  for (const [id, target, parent] of [['root-c', 'root-a', null], ['child-b', 'child-a', 'root-a'], ['grand-b', 'grand-a', 'child-a']]) {
    assert.equal((await move(id!, target!, 'before')).status, 200);
    await transact((workspace) => {
      const siblings = sortTasks(workspace.tasks.filter((task) => task.parent_task_id === parent && task.project_id === 'demo-project'));
      assert.ok(siblings.findIndex((task) => task.id === id) < siblings.findIndex((task) => task.id === target));
      assert.equal(workspace.tasks.find((task) => task.id === id)!.parent_task_id, parent);
      assert.equal(workspace.tasks.find((task) => task.id === id)!.context_payload.description, 'preserved');
    });
    assert.equal((await move(id!, target!, 'after')).status, 200);
    await transact((workspace) => {
      const siblings = sortTasks(workspace.tasks.filter((task) => task.parent_task_id === parent && task.project_id === 'demo-project'));
      assert.ok(siblings.findIndex((task) => task.id === id) > siblings.findIndex((task) => task.id === target));
    });
  }
});
test('rejects cross-parent, cross-project, cross-status, self, and unauthenticated drops', async () => {
  for (const [id, target] of [['child-a', 'root-a'], ['root-a', 'foreign'], ['root-a', 'done-root'], ['root-a', 'root-a']]) assert.equal((await move(id, target, 'before')).status, 422);
  assert.equal((await move('root-a', 'missing', 'before')).status, 404);
  assert.equal((await move('root-a', 'root-b', 'before', false)).status, 401);
});

test('descriptions can be updated and cleared at all three levels without changing hierarchy', async () => {
  for (const [id, parent] of [['root-a', null], ['child-a', 'root-a'], ['grand-a', 'child-a']]) {
    const description = 'Acceptance criteria\n• Supports multiple lines\n<script>plain text</script>';
    const request = (value: unknown) => new NextRequest(`http://localhost/api/v1/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'update-description', description: value }) });
    const context = { params: Promise.resolve({ id: id! }) };
    assert.equal((await patch(request(description), context)).status, 200);
    await transact((workspace) => {
      const task = workspace.tasks.find((item) => item.id === id)!;
      assert.equal(task.description, description);
      assert.equal(task.parent_task_id, parent);
      assert.equal(task.state, 'TRIAGE');
    });
    assert.equal((await patch(request('x'.repeat(10001)), context)).status, 422);
    assert.equal((await patch(request(null), context)).status, 422);
    assert.equal((await patch(request(''), context)).status, 200);
    await transact((workspace) => assert.equal(workspace.tasks.find((task) => task.id === id)!.description, ''));
  }
});
