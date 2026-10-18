import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const accounts: { id: string; actorId: string; email: string; cookie: string }[] = [];
async function account() {
  const password = randomBytes(24).toString('base64url');
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Developer QA', email: `developer-${randomBytes(8).toString('hex')}@example.test`, password, confirm_password: password }) });
  const data = await response.json();
  assert.equal(response.status, 201);
  const user = { ...data.user, cookie: response.headers.get('set-cookie')!.split(';')[0] }; accounts.push(user); return user;
}
async function request(cookie: string, path: string, method = 'GET', body?: unknown, workspace?: string, token?: string) {
  const response = await fetch(base + '/api/v1' + path, { method, headers: { ...(cookie ? { cookie } : {}), origin: base, 'content-type': 'application/json', ...(workspace ? { 'x-nexus-workspace': workspace } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
async function main() {
  try {
    const a = await account(); const b = await account();
    assert.equal((await request('', '/developer/keys')).status, 401);
    const project = (await request(a.cookie, '/projects', 'POST', { name: 'Developer QA project' })).data.project;
    const other = (await request(b.cookie, '/projects', 'POST', { name: 'Other project' })).data.project;
    const enqueued = await request(a.cookie, '/ingest', 'POST', { title: 'External API key task', source_type: 'MANUAL', source_ref: randomBytes(8).toString('hex'), project_id: project.id, is_agent_task: true, agent_key: 'backend' });
    assert.equal(enqueued.status, 200);
    const create = async () => {
      const result = await request(a.cookie, '/developer/keys', 'POST', { action: 'create', name: 'Backend worker', expires_in_days: 90 });
      assert.equal(result.status, 201); assert.equal(typeof result.data.token, 'string'); return result.data;
    };
    const key = await create();
    const [stored] = await sql`SELECT token_hash FROM developer_keys WHERE id = ${key.key.id}`;
    assert.equal(stored.token_hash === key.token, false);
    assert.equal(stored.token_hash === createHash('sha256').update(key.token).digest('hex'), true);
    const list = (await request(a.cookie, '/developer/keys')).data.keys;
    assert.equal(list.length, 1); assert.equal('token_hash' in list[0], false); assert.equal('token' in list[0], false);
    assert.equal((await request(b.cookie, '/developer/keys', 'GET', undefined, a.id)).status, 403);
    console.log('PASS API keys are admin-managed, hashed, and only returned in full once');
    const claimPath = `/agent/tasks?project_id=${project.id}&agent_key=backend`;
    const claimed = await request('', claimPath, 'GET', undefined, undefined, key.token);
    assert.equal(claimed.status, 200); assert.equal(claimed.data.tasks.length, 1);
    const task = claimed.data.tasks[0]; assert.equal(task.id, enqueued.data.task.id);
    const telemetry = await request('', `/tasks/${task.id}/telemetry`, 'PATCH', { state: 'WAITING_HUMAN', lock_token: task.lock_token }, undefined, key.token);
    assert.equal(telemetry.status, 200);
    const [used] = await sql`SELECT last_used_at FROM developer_keys WHERE id = ${key.key.id}`;
    assert.ok(used.last_used_at);
    console.log('PASS workspace API keys claim external tasks and report telemetry');
    assert.equal((await request('', claimPath, 'GET', undefined, b.id, key.token)).status, 403);
    assert.equal((await request('', `/agent/tasks?project_id=${other.id}&agent_key=backend`, 'GET', undefined, undefined, key.token)).status, 404);
    assert.equal((await request('', `/tasks/${task.id}`, 'PATCH', { action: 'set-priority', priority: 'HIGH' }, undefined, key.token)).status, 401);
    assert.equal((await request('', '/developer/keys', 'GET', undefined, undefined, key.token)).status, 401);
    console.log('PASS API keys cannot cross workspaces, edit human-managed fields, or manage keys');
    assert.equal((await request(a.cookie, '/developer/keys', 'POST', { action: 'revoke', key_id: key.key.id })).status, 200);
    assert.equal((await request('', claimPath, 'GET', undefined, undefined, key.token)).status, 401);
    const expiring = await create();
    await sql`UPDATE developer_keys SET expires_at = now() - interval '1 second' WHERE id = ${expiring.key.id}`;
    assert.equal((await request('', claimPath, 'GET', undefined, undefined, expiring.token)).status, 401);
    console.log('PASS revoked and expired API keys stop working immediately');
    const managed = await create();
    await request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: a.id, email: b.email, role: 'member' });
    const invitation = (await request(b.cookie, '/workspaces')).data.invitations[0];
    await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: true });
    assert.equal((await request(b.cookie, '/developer/keys', 'GET', undefined, a.id)).status, 403);
    assert.equal((await request(b.cookie, '/developer/keys', 'POST', { action: 'create', name: 'Denied' }, a.id)).status, 403);
    assert.equal((await request(b.cookie, '/developer/keys', 'POST', { action: 'revoke', key_id: managed.key.id }, a.id)).status, 403);
    await request(a.cookie, '/workspaces', 'POST', { action: 'role', workspace_id: a.id, user_id: b.id, role: 'admin' });
    await request(b.cookie, '/workspaces', 'POST', { action: 'role', workspace_id: a.id, user_id: a.id, role: 'member' });
    assert.equal((await request('', claimPath, 'GET', undefined, undefined, managed.token)).status, 401);
    console.log('PASS member restrictions and creator demotion also invalidate key access');
  } finally {
    for (const user of accounts) await sql`DELETE FROM workspaces WHERE created_by = ${user.id}`;
    for (const user of accounts) { await sql`DELETE FROM users WHERE id = ${user.id}`; await sql`DELETE FROM actors WHERE id = ${user.actorId}`; }
    await sql.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
