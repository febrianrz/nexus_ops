import { sessions, users } from '@/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { database } from './database';
import { ProtocolError } from './protocol';
import { prepareDeveloperKey } from './developer-key-auth';
import type { SessionUser } from './auth-types';

export const SESSION_COOKIE = 'nexus_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const requestUsers = new WeakMap<NextRequest, SessionUser>();
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function sessionUser(token?: string): Promise<SessionUser | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [user] = await database()
    .select({ id: users.id, name: users.name, email: users.email, actorId: users.actor_id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(
      and(
        eq(sessions.token_hash, sessionHash(token)),
        gt(sessions.expires_at, new Date().toISOString()),
      ),
    )
    .limit(1);
  return user ?? null;
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const expected = `${req.nextUrl.protocol}//${req.headers.get('host') ?? req.nextUrl.host}`;
  if (origin !== req.nextUrl.origin && origin !== expected)
    throw new ProtocolError('Request origin is not allowed', 403);
}

export async function prepareAuthentication(req: NextRequest) {
  if (req.headers.has('authorization')) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (token.startsWith('nxo_')) await prepareDeveloperKey(req, token);
    return;
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) assertSameOrigin(req);
  const user = await sessionUser(token);
  if (user) requestUsers.set(req, user);
}
export function requestUser(req: NextRequest) {
  return requestUsers.get(req);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await database()
    .insert(sessions)
    .values({
      token_hash: sessionHash(token),
      user_id: userId,
      expires_at: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
    });
  return token;
}
export function setSessionCookie(
  response: NextResponse,
  req: NextRequest,
  token: string,
  maxAge = SESSION_SECONDS,
) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(req.nextUrl.hostname);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:' || (process.env.NODE_ENV === 'production' && !local),
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  response.headers.set('Cache-Control', 'no-store');
}
export async function revokeSession(token?: string) {
  if (token && /^[a-f0-9]{64}$/.test(token))
    await database()
      .delete(sessions)
      .where(eq(sessions.token_hash, sessionHash(token)));
}
export async function limitAuthentication(key: string, limit: number, seconds: number) {
  const hashed = sessionHash(key);
  const result = await database().execute<{ attempts: number }>(sql`
    INSERT INTO auth_limits (key, attempts, resets_at)
    VALUES (${hashed}, 1, now() + ${seconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN auth_limits.resets_at <= now() THEN 1 ELSE auth_limits.attempts + 1 END,
      resets_at = CASE WHEN auth_limits.resets_at <= now() THEN now() + ${seconds} * interval '1 second' ELSE auth_limits.resets_at END
    RETURNING attempts
  `);
  if (result[0].attempts > limit)
    throw new ProtocolError('Too many attempts. Please try again later.', 429);
}
