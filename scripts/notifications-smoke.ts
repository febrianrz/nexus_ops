import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { notificationItems } from '../lib/notifications';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const accounts: { id: string; actorId: string; email: string; cookie: string }[] = [];
async function account() {
  const password = randomBytes(24).toString('base64url');
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Notification QA', email: `notification-${randomBytes(8).toString('hex')}@example.test`, password, confirm_password: password }) });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  const entry = { ...data.user, cookie: response.headers.get('set-cookie')!.split(';')[0] };
  accounts.push(entry);
  return entry;
}
async function request(cookie: string, path: string, method = 'GET', body?: unknown, workspace?: string) {
  const response = await fetch(base + '/api/v1' + path, { method, headers: { cookie, origin: base, 'content-type': 'application/json', ...(workspace ? { 'x-nexus-workspace': workspace } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
async function main() {
  try {
    const a = await account();
    const b = await account();
    const workspace = (await request(a.cookie, '/workspaces', 'POST', { action: 'create', name: 'Notification QA workspace' })).workspace.id;
    const inbox = async (cookie: string, id?: string) => {
      const team = await request(cookie, '/workspaces', 'GET', undefined, id);
      const data = await request(cookie, '/workspace', 'GET', undefined, id);
      return notificationItems(data.tasks, data.projects, team.invitations);
    };
    const invite = async () => {
      await request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: workspace, email: b.email, role: 'member' });
      return (await request(b.cookie, '/workspaces')).invitations[0];
    };
    assert.equal((await inbox(b.cookie)).length, 0);
    let invitation = await invite();
    let items = await inbox(b.cookie);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'invitation');
    assert.equal(items[0].id, invitation.id);
    await sql`UPDATE workspace_invitations SET expires_at = now() - interval '1 second' WHERE id = ${invitation.id}`;
    assert.equal((await inbox(b.cookie)).length, 0);
    invitation = await invite();
    assert.equal((await inbox(b.cookie)).length, 1);
    await request(a.cookie, '/workspaces', 'POST', { action: 'revoke', workspace_id: workspace, invitation_id: invitation.id });
    assert.equal((await inbox(b.cookie)).length, 0);
    invitation = await invite();
    await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: false });
    assert.equal((await inbox(b.cookie)).length, 0);
    invitation = await invite();
    await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: true });
    assert.equal((await inbox(b.cookie, workspace)).length, 0);
    console.log('PASS invitation notifications appear and disappear on expiry, revoke, decline and accept');
    const taskIds: string[] = [];
    for (const name of ['First project', 'Second project']) {
      const project = (await request(a.cookie, '/projects', 'POST', { name }, workspace)).project;
      const task = (await request(a.cookie, '/ingest', 'POST', { title: `Testing ${name}`, project_id: project.id, source_type: 'MANUAL', source_ref: randomBytes(8).toString('hex') }, workspace)).task;
      taskIds.push(task.id);
      await request(a.cookie, `/tasks/${task.id}`, 'PATCH', { action: 'set-status', state: 'WAITING_HUMAN' }, workspace);
    }
    items = await inbox(b.cookie, workspace);
    assert.equal(items.length, 2);
    assert.deepEqual(items.filter((item) => item.kind === 'task').map((item) => item.task.project_id).sort(), (await request(a.cookie, '/workspace', 'GET', undefined, workspace)).projects.map((project: { id: string }) => project.id).sort());
    assert.equal((await inbox(b.cookie)).length, 0);
    await request(b.cookie, `/tasks/${taskIds[0]}`, 'PATCH', { action: 'set-status', state: 'DONE' }, workspace);
    assert.equal((await inbox(b.cookie, workspace)).length, 1);
    await request(b.cookie, `/tasks/${taskIds[1]}`, 'PATCH', { action: 'set-status', state: 'DONE' }, workspace);
    assert.equal((await inbox(b.cookie, workspace)).length, 0);
    console.log('PASS notifications span all current-workspace projects, remain isolated, and resolve when tasks complete');
    await request(a.cookie, '/workspaces', 'POST', { action: 'remove', workspace_id: workspace, user_id: b.id });
    assert.equal((await fetch(base + '/api/v1/workspace', { headers: { cookie: b.cookie, 'x-nexus-workspace': workspace } })).status, 403);
    assert.equal((await inbox(b.cookie)).length, 0);
    console.log('PASS removed members cannot reload foreign notification data');
  } finally {
    for (const entry of accounts) await sql`DELETE FROM workspaces WHERE created_by = ${entry.id}`;
    for (const entry of accounts) { await sql`DELETE FROM users WHERE id = ${entry.id}`; await sql`DELETE FROM actors WHERE id = ${entry.actorId}`; }
    await sql.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
