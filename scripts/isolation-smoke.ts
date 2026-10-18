import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const accounts: { id: string; actorId: string; cookie: string }[] = [];
async function request(path: string, method = 'GET', body?: unknown, cookie?: string) {
  return fetch(base + path, {
    method,
    headers: { origin: base, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function register() {
  const password = randomBytes(24).toString('base64url');
  const response = await request('/api/auth/register', 'POST', {
    name: 'Isolation QA',
    email: `isolation-${randomBytes(8).toString('hex')}@example.test`,
    password,
    confirm_password: password,
  });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  const account = { ...data.user, cookie: response.headers.get('set-cookie')!.split(';')[0] };
  accounts.push(account);
  return account;
}
async function main() {
  try {
    const a = await register();
    const response = await request('/api/v1/workspace', 'GET', undefined, a.cookie);
    assert.equal(response.status, 200);
    const workspace = await response.json();
    console.log(
      `Fresh account: tasks=${workspace.tasks.length}, events=${workspace.events.length}, agents=${workspace.actors.filter((actor: { type: string }) => actor.type === 'AGENT').length}`,
    );
    assert.equal(workspace.tasks.length, 0, 'A newly registered account must have zero tasks');
    assert.equal(workspace.events.length, 0, 'A newly registered account must have zero events');
    assert.equal(
      workspace.actors.filter((actor: { type: string }) => actor.type === 'AGENT').length,
      0,
      'A newly registered account must have zero agents',
    );
    console.log('PASS fresh registration is empty');
    const b = await register();
    const projectAResponse = await request('/api/v1/projects', 'POST', { name: 'Isolated project' }, a.cookie);
    const projectBResponse = await request('/api/v1/projects', 'POST', { name: 'Isolated project' }, b.cookie);
    assert.equal(projectAResponse.status, 200);
    assert.equal(projectBResponse.status, 200);
    const projectA = (await projectAResponse.json()).project;
    const projectB = (await projectBResponse.json()).project;
    console.log('PASS identical project names remain isolated per workspace');
    const sourceRef = `isolation-${randomBytes(6).toString('hex')}`;
    const payload = { title: 'Owned isolation task', source_type: 'MANUAL', source_ref: sourceRef, project_id: projectA.id };
    const createA = await request('/api/v1/ingest', 'POST', payload, a.cookie);
    assert.equal(createA.status, 200);
    const taskA = (await createA.json()).task;
    assert.equal(taskA.assignee_id, null, 'Tasks without a triage agent must be unassigned');
    const emptyB = await (await request('/api/v1/workspace', 'GET', undefined, b.cookie)).json();
    assert.equal(emptyB.tasks.length, 0);
    assert.equal(emptyB.events.length, 0);
    assert.equal(
      emptyB.actors.some(
        (actor: { id: string }) => actor.id === a.actorId,
      ),
      false,
    );
    console.log('PASS account B cannot see account A tasks, events or identities');
    const spoofed = await fetch(base + '/api/v1/workspace', {
      headers: { cookie: b.cookie, 'X-Nexus-Owner': a.id },
    });
    const spoofedData = await spoofed.json();
    assert.equal(spoofed.status, 200);
    assert.equal(spoofedData.tasks.length, 0);
    assert.equal(
      spoofedData.actors.some((actor: { id: string }) => actor.id === a.actorId),
      false,
    );
    console.log('PASS cookie sessions cannot switch owners using a forged header');

    const createB = await request('/api/v1/ingest', 'POST', { ...payload, project_id: projectB.id }, b.cookie);
    assert.equal(createB.status, 200);
    const taskB = (await createB.json()).task;
    assert.notEqual(taskA.id, taskB.id);
    const repeatedA = await (await request('/api/v1/ingest', 'POST', payload, a.cookie)).json();
    assert.equal(repeatedA.duplicate, true);
    assert.equal(repeatedA.task.id, taskA.id);
    console.log('PASS source deduplication and task IDs work independently across accounts');
    for (const [suffix, method, body] of [
      ['/events', 'POST', { message: 'Access probe' }],
      ['', 'PATCH', { action: 'set-priority', priority: 'HIGH' }],
      ['', 'PATCH', { action: 'update-description', description: 'Denied' }],
      ['', 'PATCH', { action: 'update-planning', completion: 50 }],
      ['/telemetry', 'PATCH', { confidence_score: 0.5 }],
      ['', 'PATCH', { action: 'queue' }],
    ] as const) {
      const denied = await request(`/api/v1/tasks/${taskA.id}${suffix}`, method, body, b.cookie);
      assert.equal(denied.status, 404, `${method} ${suffix} must not access another account`);
    }
    assert.equal((await fetch(base + '/api/v1/workspace', { headers: { cookie: b.cookie, 'x-nexus-workspace': a.id } })).status, 403);
    assert.equal((await request(`/api/v1/tasks/${taskA.id}/attachments`, 'GET', undefined, b.cookie)).status, 403);
    assert.equal((await request('/api/v1/ingest', 'POST', payload, b.cookie)).status, 422);
    console.log('PASS foreign task edits, workspace headers, attachments and project references are rejected');
    const comment = await request(
      `/api/v1/tasks/${taskA.id}/events`,
      'POST',
      { message: 'Owner comment' },
      a.cookie,
    );
    assert.equal(comment.status, 200);
    const finalA = await (await request('/api/v1/workspace', 'GET', undefined, a.cookie)).json();
    const finalB = await (await request('/api/v1/workspace', 'GET', undefined, b.cookie)).json();
    assert.equal(finalA.tasks.length, 1);
    assert.equal(finalB.tasks.length, 1);
    assert.ok(
      finalA.events.some(
        (event: { human_message: string }) => event.human_message === 'Owner comment',
      ),
    );
    assert.equal(
      finalB.events.some(
        (event: { human_message: string }) => event.human_message === 'Owner comment',
      ),
      false,
    );
    const [counts] =
      await sql`SELECT (SELECT count(*) FROM tasks WHERE owner_user_id = ${a.id}) AS tasks, (SELECT count(*) FROM actors WHERE owner_user_id = ${a.id}) AS actors, (SELECT count(*) FROM task_events WHERE owner_user_id = ${a.id}) AS events`;
    assert.equal(Number(counts.tasks), finalA.tasks.length);
    assert.equal(Number(counts.actors), finalA.actors.length);
    assert.equal(Number(counts.events), finalA.events.length);
    console.log('PASS dashboard counts match persisted PostgreSQL records for the owner');
  } finally {
    for (const account of accounts) {
      await sql`DELETE FROM workspaces WHERE created_by = ${account.id}`;
      await sql`DELETE FROM users WHERE id = ${account.id}`;
      await sql`DELETE FROM actors WHERE id = ${account.actorId}`;
    }
    await sql.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Isolation failed');
    process.exit(1);
  });
