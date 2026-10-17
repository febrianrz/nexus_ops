import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '../lib/password';
import { loginInput, registerInput } from '../lib/auth-validation';
import {
  assertSameOrigin,
  sessionHash,
  sessionUser,
  setSessionCookie,
  SESSION_COOKIE,
} from '../lib/auth';

test('passwords are salted, hashed, and verified without storing plaintext', async () => {
  const password = 'a long testing passphrase';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect password', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
});
test('registration normalizes email and rejects short passwords, mismatched confirmation, and extra fields', () => {
  const base = {
    name: ' Test User ',
    email: ' PERSON@Example.com ',
    password: 'correct testing phrase',
    confirm_password: 'correct testing phrase',
  };
  const parsed = registerInput.parse(base);
  assert.equal(parsed.email, 'person@example.com');
  assert.equal(parsed.name, 'Test User');
  assert.equal(registerInput.safeParse({ ...base, password: 'short' }).success, false);
  assert.equal(registerInput.safeParse({ ...base, confirm_password: 'different' }).success, false);
  assert.equal(registerInput.safeParse({ ...base, is_admin: true }).success, false);
  assert.equal(loginInput.safeParse({ email: 'invalid', password: 'password' }).success, false);
});
test('cookie mutations reject missing and cross-origin request origins', () => {
  const origin = 'http://localhost:3002';
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new NextRequest(origin + '/api/auth/logout', { method: 'POST', headers: { origin } }),
    ),
  );
  assert.throws(() =>
    assertSameOrigin(new NextRequest(origin + '/api/auth/logout', { method: 'POST' })),
  );
  assert.throws(() =>
    assertSameOrigin(
      new NextRequest(origin + '/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
      }),
    ),
  );
});
test('session cookies are HttpOnly, SameSite, scoped to the site and removable on logout', () => {
  const req = new NextRequest('https://nexus.example/api/auth/login');
  const response = NextResponse.json({ success: true });
  setSessionCookie(response, req, 'a'.repeat(64));
  const cookie = response.headers.get('set-cookie')!;
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('Secure'));
  assert.ok(cookie.includes('SameSite=lax'));
  assert.ok(cookie.includes('Path=/'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  setSessionCookie(response, req, '', 0);
  assert.equal(response.cookies.get(SESSION_COOKIE)?.value, '');
  assert.ok(response.headers.get('set-cookie')!.includes('Max-Age=0'));
});
test('untrusted or missing session tokens cannot resolve a session', async () => {
  assert.equal(await sessionUser(), null);
  assert.equal(await sessionUser('invalid'), null);
  assert.equal(await sessionUser('abc;admin=true'), null);
  assert.equal(sessionHash('a'.repeat(64)).length, 64);
  assert.notEqual(sessionHash('a'.repeat(64)), 'a'.repeat(64));
});
