import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { sessionHash } from '../lib/auth';

loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const email = `auth-smoke-${randomBytes(8).toString('hex')}@example.test`;
const password = randomBytes(24).toString('base64url');
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let userId: string | undefined;
let actorId: string | undefined;
const pass = (label: string) => console.log(`PASS ${label}`);
function request(path: string, body?: unknown, cookie?: string, origin = base) {
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function main() {
  try {
    const guest = await request('/');
    assert.equal(guest.status, 307);
    assert.ok(guest.headers.get('location')?.includes('/login'));
    pass('workspace redirects guests');
    const denied = await request('/api/v1/workspace');
    assert.equal(denied.status, 401);
    pass('workspace API rejects guests');
    const badOrigin = await request(
      '/api/auth/register',
      { name: 'QA Test', email, password, confirm_password: password },
      undefined,
      'https://untrusted.example',
    );
    assert.equal(badOrigin.status, 403);
    pass('cross-origin registration rejected');
    const registered = await request('/api/auth/register', {
      name: 'QA Auth Test',
      email,
      password,
      confirm_password: password,
    });
    const registration = await registered.json();
    assert.equal(registered.status, 201, JSON.stringify(registration));
    userId = registration.user.id;
    actorId = registration.user.actorId;
    const original = registered.headers.get('set-cookie')!;
    assert.ok(original.includes('HttpOnly'));
    assert.ok(original.includes('SameSite=lax'));
    const cookie = original.split(';')[0];
    pass('register creates a user, human identity and session');
    const [stored] = await sql`SELECT password_hash FROM users WHERE id = ${userId!}`;
    assert.ok(stored.password_hash.startsWith('scrypt$'));
    assert.notEqual(stored.password_hash, password);
    pass('password stored as scrypt hash');
    const me = await (await request('/api/auth/session', undefined, cookie)).json();
    assert.equal(me.user.id, userId);
    assert.equal('password_hash' in me.user, false);
    const workspace = await request('/api/v1/workspace', undefined, cookie);
    assert.equal(workspace.status, 200);
    const data = await workspace.json();
    assert.equal(data.storage, 'postgresql');
    assert.ok(data.actors.some((a: { id: string }) => a.id === actorId));
    pass('session authenticates PostgreSQL workspace');
    const duplicate = await request('/api/auth/register', {
      name: 'QA Test',
      email: email.toUpperCase(),
      password,
      confirm_password: password,
    });
    assert.equal(duplicate.status, 409);
    pass('duplicate email rejected case-insensitively');
    const incorrect = await request('/api/auth/login', { email, password: 'incorrect passphrase' });
    assert.equal(incorrect.status, 401);
    pass('incorrect credentials rejected');
    const crossLogout = await request('/api/auth/logout', {}, cookie, 'https://untrusted.example');
    assert.equal(crossLogout.status, 403);
    pass('cross-origin logout rejected');
    const signedOut = await request('/api/auth/logout', {}, cookie);
    assert.equal(signedOut.status, 200);
    assert.ok(signedOut.headers.get('set-cookie')?.includes('Max-Age=0'));
    assert.equal((await request('/api/v1/workspace', undefined, cookie)).status, 401);
    pass('logout revokes the server session and cookie');
    const loggedIn = await request('/api/auth/login', { email: email.toUpperCase(), password });
    assert.equal(loggedIn.status, 200);
    const newCookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(newCookie, cookie);
    pass('login issues a fresh session');
    const rotated = await request('/api/auth/login', { email, password }, newCookie);
    assert.equal(rotated.status, 200);
    const rotatedCookie = rotated.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(rotatedCookie, newCookie);
    assert.equal((await request('/api/v1/workspace', undefined, newCookie)).status, 401);
    pass('login rotates and revokes an existing browser session');
    const hash = sessionHash(rotatedCookie.split('=')[1]);
    await sql`UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = ${hash}`;
    assert.equal((await request('/api/v1/workspace', undefined, rotatedCookie)).status, 401);
    pass('expired sessions cannot access the workspace');
    const [counts] = await sql`SELECT count(*) AS count FROM actors WHERE id = ${actorId!}`;
    assert.equal(Number(counts.count), 1);
    pass('registration creates exactly one human actor');
  } finally {
    if (userId) await sql`DELETE FROM workspaces WHERE created_by = ${userId}`;
    if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
    if (actorId) await sql`DELETE FROM actors WHERE id = ${actorId}`;
    await sql.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Auth smoke test failed');
    process.exit(1);
  });
