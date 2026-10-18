import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const accounts: { id: string; actorId: string; email: string; cookie: string }[] = [];
const emails = Array.from(
  { length: 3 },
  () => `workspace-qa-${randomBytes(8).toString('hex')}@example.test`,
);
async function request(
  cookie: string,
  path: string,
  method = 'GET',
  body?: unknown,
  workspace?: string,
) {
  const response = await fetch(base + '/api/v1' + path, {
    method,
    headers: {
      cookie,
      origin: base,
      'content-type': 'application/json',
      ...(workspace ? { 'x-nexus-workspace': workspace } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { status: response.status, data };
}
async function account(email: string) {
  const password = randomBytes(24).toString('base64url');
  const response = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Workspace QA', email, password, confirm_password: password }),
  });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  const result = { ...data.user, cookie: response.headers.get('set-cookie')!.split(';')[0] };
  accounts.push(result);
  return result;
}
const pass = (label: string) => console.log(`PASS ${label}`);
async function main() {
  try {
    const a = await account(emails[0]);
    const b = await account(emails[1]);
    const c = await account(emails[2]);
    const create = await request(a.cookie, '/workspaces', 'POST', {
      action: 'create',
      name: 'Engineering collaboration',
    });
    assert.equal(create.status, 200, JSON.stringify(create.data));
    const id = create.data.workspace.id;
    let metadata = (await request(a.cookie, '/workspaces', 'GET', undefined, id)).data;
    assert.equal(metadata.workspaces.length, 2);
    assert.equal(metadata.current.role, 'admin');
    assert.equal(metadata.members.length, 1);
    assert.equal(
      (await request(a.cookie, '/workspace', 'GET', undefined, id)).data.tasks.length,
      0,
    );
    pass('users can create multiple empty workspaces and become admin');
    assert.equal((await request(b.cookie, '/workspace', 'GET', undefined, id)).status, 403);
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: emails[2],
          role: 'admin',
        })
      ).status,
      403,
    );
    pass('non-members cannot access a workspace or manage invitations');
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: b.email.toUpperCase(),
          role: 'member',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: b.email,
          role: 'member',
        })
      ).status,
      409,
    );
    let invites = (await request(b.cookie, '/workspaces')).data.invitations;
    assert.equal(invites.length, 1);
    assert.equal(invites[0].role, 'member');
    assert.equal((await request(b.cookie, '/workspace', 'GET', undefined, id)).status, 403);
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: invites[0].id,
          accept: true,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: invites[0].id,
          accept: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: invites[0].id,
          accept: true,
        })
      ).status,
      404,
    );
    pass(
      'in-app invitations require matching email and explicit acceptance, and cannot be replayed',
    );
    const project = await request(b.cookie, '/projects', 'POST', { name: 'Shared QA project' }, id);
    assert.equal(project.status, 200, JSON.stringify(project.data));
    const payload = {
      project_id: project.data.project.id,
      title: 'Shared engineering task',
      source_type: 'MANUAL',
      source_ref: 'shared-qa',
    };
    const createdTask = await request(b.cookie, '/ingest', 'POST', payload, id);
    assert.equal(createdTask.status, 200, JSON.stringify(createdTask.data));
    const task = createdTask.data.task;
    assert.ok(task.id);
    const board = (await request(a.cookie, '/workspace', 'GET', undefined, id)).data;
    assert.equal(board.tasks[0].id, task.id);
    assert.equal(
      board.actors.filter((actor: { type: string }) => actor.type === 'HUMAN').length,
      2,
    );
    assert.equal((await request(a.cookie, '/workspace')).data.tasks.length, 0);
    assert.equal((await request(b.cookie, '/workspace')).data.tasks.length, 0);
    assert.equal(
      (
        await request(
          a.cookie,
          `/tasks/${task.id}/events`,
          'POST',
          { message: 'Shared review context' },
          id,
        )
      ).status,
      200,
    );
    assert.ok(
      (await request(b.cookie, '/workspace', 'GET', undefined, id)).data.events.some(
        (event: { human_message: string }) => event.human_message === 'Shared review context',
      ),
    );
    pass(
      'members collaborate on persisted tasks and comments while personal workspaces stay isolated',
    );
    for (const body of [
      { action: 'invite', email: emails[2], role: 'admin' },
      { action: 'role', user_id: b.id, role: 'admin' },
      { action: 'remove', user_id: a.id },
      { action: 'rename', name: 'Unauthorized rename' },
    ])
      assert.equal(
        (await request(b.cookie, '/workspaces', 'POST', { ...body, workspace_id: id })).status,
        403,
      );
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'role',
          workspace_id: id,
          user_id: a.id,
          role: 'member',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'remove',
          workspace_id: id,
          user_id: a.id,
        })
      ).status,
      409,
    );
    pass('member privileges are enforced by the server and last admin is protected');
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'role',
          workspace_id: id,
          user_id: b.id,
          role: 'admin',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'rename',
          workspace_id: id,
          name: 'Engineering team',
        })
      ).status,
      200,
    );
    pass('admin can promote members and promoted admins can rename the workspace');
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: emails[2],
          role: 'admin',
        })
      ).status,
      200,
    );
    invites = (await request(c.cookie, '/workspaces')).data.invitations;
    assert.equal(invites.length, 1);
    assert.equal(invites[0].role, 'admin');
    await sql`UPDATE workspace_invitations SET expires_at = now() - interval '1 second' WHERE id = ${invites[0].id}`;
    assert.equal(
      (
        await request(c.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: invites[0].id,
          accept: true,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: emails[2],
          role: 'admin',
        })
      ).status,
      200,
    );
    invites = (await request(c.cookie, '/workspaces')).data.invitations;
    assert.equal(
      (
        await request(c.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: invites[0].id,
          accept: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(c.cookie, '/workspaces', 'GET', undefined, id)).data.current.role,
      'admin',
    );
    pass('invitations preserve the selected role and expired invitations cannot grant access');
    await request(a.cookie, '/workspaces', 'POST', {
      action: 'role',
      workspace_id: id,
      user_id: b.id,
      role: 'member',
    });
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: 'new@example.test',
          role: 'member',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'remove',
          workspace_id: id,
          user_id: b.id,
        })
      ).status,
      200,
    );
    assert.equal((await request(b.cookie, '/workspace', 'GET', undefined, id)).status, 403);
    assert.equal(
      (await request(b.cookie, `/tasks/${task.id}/events`, 'POST', { message: 'Denied' }, id))
        .status,
      403,
    );
    assert.equal(
      (await request(a.cookie, '/workspace', 'GET', undefined, id)).data.tasks.length,
      1,
    );
    pass('role changes and removal apply immediately without deleting shared tasks');
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: b.email,
          role: 'member',
        })
      ).status,
      200,
    );
    metadata = (await request(a.cookie, '/workspaces', 'GET', undefined, id)).data;
    const pending = metadata.pending.find((entry: { email: string }) => entry.email === b.email);
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'revoke',
          workspace_id: id,
          invitation_id: pending.id,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(b.cookie, '/workspaces', 'POST', {
          action: 'respond',
          invitation_id: pending.id,
          accept: true,
        })
      ).status,
      404,
    );
    pass('revoked invitations cannot be accepted');
    assert.equal(
      (
        await request(a.cookie, '/workspaces', 'POST', {
          action: 'invite',
          workspace_id: id,
          email: 'unregistered-qa@example.test',
          role: 'member',
        })
      ).status,
      422,
    );
    pass('in-app invitations require an existing registered recipient');
    for (const name of ['', ' ', 'x', 'x'.repeat(81)]) assert.equal((await request(a.cookie, '/workspaces', 'POST', { action: 'create', name })).status, 422);
    assert.equal((await request('', '/workspaces')).status, 401);
    assert.equal((await request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: id, email: a.email, role: 'member' })).status, 409);
    assert.equal((await request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: id, email: b.email, role: 'owner' })).status, 422);
    pass('empty, oversized and invalid inputs, self-invites, and unauthenticated access are rejected');
    const inviteB = () => request(a.cookie, '/workspaces', 'POST', { action: 'invite', workspace_id: id, email: b.email, role: 'member' });
    assert.equal((await inviteB()).status, 200);
    let invitation = (await request(b.cookie, '/workspaces')).data.invitations.find((entry: { workspace_id: string }) => entry.workspace_id === id);
    assert.equal((await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: false })).status, 200);
    assert.equal((await request(b.cookie, '/workspaces')).data.invitations.length, 0);
    assert.equal((await request(b.cookie, '/workspace', 'GET', undefined, id)).status, 403);
    assert.equal((await request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: true })).status, 404);
    pass('declining clears the invitation and never grants workspace access');
    const duplicates = await Promise.all([inviteB(), inviteB()]);
    assert.deepEqual(duplicates.map((result) => result.status).sort(), [200, 409]);
    invitation = (await request(b.cookie, '/workspaces')).data.invitations.find((entry: { workspace_id: string }) => entry.workspace_id === id);
    const accepts = await Promise.all(Array.from({ length: 2 }, () => request(b.cookie, '/workspaces', 'POST', { action: 'respond', invitation_id: invitation.id, accept: true })));
    assert.deepEqual(accepts.map((result) => result.status).sort(), [200, 404]);
    assert.equal((await request(a.cookie, '/workspaces', 'GET', undefined, id)).data.members.filter((entry: { user_id: string }) => entry.user_id === b.id).length, 1);
    pass('concurrent invites and accepts cannot duplicate pending invitations or memberships');
    const lastAdmins = await Promise.all([
      request(a.cookie, '/workspaces', 'POST', { action: 'role', workspace_id: id, user_id: a.id, role: 'member' }),
      request(c.cookie, '/workspaces', 'POST', { action: 'role', workspace_id: id, user_id: c.id, role: 'member' }),
    ]);
    assert.deepEqual(lastAdmins.map((result) => result.status).sort(), [200, 409]);
    assert.equal((await request(c.cookie, '/workspaces', 'GET', undefined, id)).data.members.filter((entry: { role: string }) => entry.role === 'admin').length, 1);
    pass('concurrent admin demotions preserve at least one admin');
    const deniedCsrf = await fetch(base + '/api/v1/workspaces', {
      method: 'POST',
      headers: {
        cookie: a.cookie,
        origin: 'https://untrusted.example',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'create', name: 'Forbidden' }),
    });
    assert.equal(deniedCsrf.status, 403);
    pass('workspace mutations reject cross-origin requests');
  } finally {
    for (const entry of accounts) await sql`DELETE FROM workspaces WHERE created_by = ${entry.id}`;
    for (const entry of accounts) {
      await sql`DELETE FROM users WHERE id = ${entry.id}`;
      await sql`DELETE FROM actors WHERE id = ${entry.actorId}`;
    }
    await sql.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
