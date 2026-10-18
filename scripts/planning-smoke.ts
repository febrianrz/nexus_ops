import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let account: { id: string; actorId: string } | undefined;
let cookie = '';
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { cookie, origin: base, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, data: await response.json() };
}
async function main() {
  try {
    const password = randomBytes(24).toString('base64url');
    const registered = await request('/api/auth/register', 'POST', { name: 'Planning QA', email: `planning-${randomBytes(8).toString('hex')}@example.test`, password, confirm_password: password });
    assert.equal(registered.response.status, 201, JSON.stringify(registered.data));
    account = registered.data.user;
    cookie = registered.response.headers.get('set-cookie')!.split(';')[0];
    const project = await request('/api/v1/projects', 'POST', { name: 'Planning QA project' });
    assert.equal(project.response.status, 200, JSON.stringify(project.data));
    const created = await request('/api/v1/ingest', 'POST', { title: 'Planning persistence check', source_type: 'MANUAL', source_ref: `planning-${randomBytes(8).toString('hex')}`, project_id: project.data.project.id, context_payload: { start_date: '2026-10-18', due_date: '2026-10-25', completion: 20 } });
    assert.equal(created.response.status, 200, JSON.stringify(created.data));
    const id = created.data.task.id;
    const description = 'Description persistence check\nAcceptance criteria and context';
    const described = await request(`/api/v1/tasks/${id}`, 'PATCH', { action: 'update-description', description });
    assert.equal(described.response.status, 200);
    const [describedRow] = await sql`SELECT description FROM tasks WHERE id = ${id}`;
    assert.equal(describedRow.description, description);
    for (const parent of [null]) {
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        const sibling = await request('/api/v1/ingest', 'POST', { title: 'Order QA task', source_type: 'MANUAL', source_ref: `order-${randomBytes(8).toString('hex')}`, project_id: project.data.project.id, parent_task_id: parent });
        assert.equal(sibling.response.status, 200);
        ids.push(sibling.data.task.id);
      }
      const moved = await request(`/api/v1/tasks/${ids[1]}`, 'PATCH', { action: 'reorder', target_id: ids[0], placement: 'before' });
      assert.equal(moved.response.status, 200, JSON.stringify(moved.data));
      const [first] = await sql`SELECT context_payload FROM tasks WHERE id = ${ids[1]}`;
      const [second] = await sql`SELECT context_payload FROM tasks WHERE id = ${ids[0]}`;
      assert.ok(first.context_payload.sort_order < second.context_payload.sort_order);
      const reloaded = await request('/api/v1/workspace');
      assert.ok(reloaded.data.tasks.findIndex((task: { id: string }) => task.id === ids[1]) < reloaded.data.tasks.findIndex((task: { id: string }) => task.id === ids[0]));
    }
    const updated = await request(`/api/v1/tasks/${id}`, 'PATCH', { action: 'update-planning', due_date: '2026-11-02', completion: 65 });
    assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
    for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']) {
      const changed = await request(`/api/v1/tasks/${id}`, 'PATCH', { action: 'set-priority', priority });
      assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
      const [stored] = await sql`SELECT priority FROM tasks WHERE id = ${id}`;
      assert.equal(stored.priority, priority);
    }
    const [row] = await sql`SELECT context_payload FROM tasks WHERE id = ${id}`;
    assert.equal(row.context_payload.start_date, '2026-10-18');
    assert.equal(row.context_payload.due_date, '2026-11-02');
    assert.equal(row.context_payload.completion, 65);
    const reread = await request('/api/v1/workspace');
    assert.equal(reread.data.tasks.find((task: { id: string }) => task.id === id).context_payload.completion, 65);
    const invalid = await request(`/api/v1/tasks/${id}`, 'PATCH', { action: 'update-planning', due_date: '2026-10-01' });
    assert.equal(invalid.response.status, 422);
    const cleared = await request(`/api/v1/tasks/${id}`, 'PATCH', { action: 'update-planning', due_date: null, start_date: null, completion: null });
    assert.equal(cleared.response.status, 200);
    const [empty] = await sql`SELECT context_payload FROM tasks WHERE id = ${id}`;
    assert.equal(empty.context_payload.due_date, null);
    assert.equal(empty.context_payload.completion, null);
    console.log('PASS PostgreSQL description, ordering, planning and priority persistence');
  } finally {
    if (account) {
      await sql`DELETE FROM workspaces WHERE created_by = ${account.id}`;
      await sql`DELETE FROM users WHERE id = ${account.id}`;
      await sql`DELETE FROM actors WHERE id = ${account.actorId}`;
    }
    await sql.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
