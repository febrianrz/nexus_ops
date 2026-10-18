import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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
    assert.equal((await request('', '/agents')).status, 401);
    const project = (await request(a.cookie, '/projects', 'POST', { name: 'Agent QA project' })).data.project;
    const created = await request(a.cookie, '/agents', 'POST', { action: 'create', name: 'Backend agent', username: 'backend' });
    assert.equal(created.status, 200); const agent = created.data.agent;
    assert.equal('api_key_hash' in agent, false);
    assert.equal((await request(a.cookie, '/agents', 'POST', { action: 'create', name: 'Duplicate', username: 'backend' })).status, 409);
    assert.equal((await request(b.cookie, '/agents', 'POST', { action: 'update', id: agent.id, name: 'Denied', username: 'denied' })).status, 404);
    let parent: string | undefined;
    const tasks: string[] = [];
    for (let depth = 0; depth < 3; depth++) {
      const result = await request(a.cookie, '/ingest', 'POST', { title: `Layer ${depth} task`, source_type: 'MANUAL', source_ref: randomBytes(8).toString('hex'), project_id: project.id, ...(parent ? { parent_task_id: parent } : {}) });
      assert.equal(result.status, 200); parent = result.data.task.id; tasks.push(parent!);
      const assigned = await request(a.cookie, `/tasks/${parent}`, 'PATCH', { action: 'set-assignee', assignee_id: agent.id });
      assert.equal(assigned.status, 200); assert.equal(assigned.data.agent_key, 'backend'); assert.equal(assigned.data.state, 'QUEUED');
    }
    const foreign = (await request(b.cookie, '/workspace')).data.actors[0];
    assert.equal((await request(a.cookie, `/tasks/${parent}`, 'PATCH', { action: 'set-assignee', assignee_id: foreign.id })).status, 404);
    console.log('PASS agent CRUD, unique usernames, workspace isolation and all three task layers');
    const key = (await request(a.cookie, '/developer/keys', 'POST', { action: 'create', name: 'Agent QA worker', expires_in_days: 30 })).data;
    const claimed = await request('', `/agent/tasks?project_id=${project.id}&agent_key=backend`, 'GET', undefined, undefined, key.token);
    assert.equal(claimed.status, 200); assert.equal(claimed.data.tasks.length, 3);
    const unchanged = await request(a.cookie, `/tasks/${claimed.data.tasks[0].id}`, 'PATCH', { action: 'set-assignee', assignee_id: agent.id });
    assert.equal(unchanged.data.lock_token, claimed.data.tasks[0].lock_token);
    await request(a.cookie, '/agents', 'POST', { action: 'update', id: agent.id, name: 'Renamed agent', username: 'backend2' });
    const stale = claimed.data.tasks[0];
    assert.equal((await request('', `/tasks/${stale.id}/telemetry`, 'PATCH', { state: 'DONE', lock_token: stale.lock_token }, undefined, key.token)).status, 409);
    const state = (await request(a.cookie, '/workspace')).data;
    assert.ok(state.tasks.every((t: {agent_key:string;lock_token:string|null}) => t.agent_key === 'backend2' && t.lock_token === null));
    const human = state.actors.find((actor: {type:string}) => actor.type === 'HUMAN');
    const assignedHuman = await request(a.cookie, `/tasks/${tasks[0]}`, 'PATCH', { action: 'set-assignee', assignee_id: human.id });
    assert.equal(assignedHuman.data.is_agent_task, false); assert.equal(assignedHuman.data.agent_key, null);
    console.log('PASS external worker claims, rename routing and stale claim invalidation, human assignment');
    await request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: a.id, email: b.email, role: 'member' });
    const invitation = (await request(b.cookie, '/workspaces')).data.invitations[0];
    await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: true });
    assert.equal((await request(b.cookie, '/agents', 'POST', { action: 'delete', id: agent.id }, a.id)).status, 403);
    assert.equal((await request(b.cookie, `/tasks/${tasks[1]}`, 'PATCH', { action: 'set-assignee', assignee_id: agent.id }, a.id)).status, 200);
    assert.equal((await request(a.cookie, '/agents', 'POST', { action: 'delete', id: agent.id })).status, 200);
    const after = (await request(a.cookie, '/workspace')).data;
    assert.equal(after.actors.some((actor: {id:string}) => actor.id === agent.id), false);
    assert.equal(after.tasks.length, 3);
    assert.ok(after.tasks.filter((t: {id:string}) => t.id !== tasks[0]).every((t: {assignee_id:string|null;is_agent_task:boolean}) => t.assignee_id === null && !t.is_agent_task));
    assert.equal((await request(a.cookie, `/tasks/${tasks[1]}`, 'PATCH', { action: 'set-assignee', assignee_id: agent.id })).status, 404);
    assert.equal((await request(a.cookie, '/agents', 'POST', { action: 'create', name: 'Replacement', username: 'backend2' })).status, 200);
    console.log('PASS member permissions, removal preserves tasks and clears routing, username reuse');
  } finally {
    for (const user of accounts) await sql`DELETE FROM workspaces WHERE created_by = ${user.id}`;
    for (const user of accounts) { await sql`DELETE FROM users WHERE id = ${user.id}`; await sql`DELETE FROM actors WHERE id = ${user.actorId}`; }
    await sql.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
