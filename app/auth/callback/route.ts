import { NextRequest, NextResponse } from 'next/server';
import { alterOneProfile } from '@/lib/alter-one';
import { createSession, revokeSession, SESSION_COOKIE, setSessionCookie } from '@/lib/auth';
import { database } from '@/lib/database';
import { hashPassword } from '@/lib/password';
import { actors, users, workspaces, workspaceMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'node:crypto';

function appUrl(req: NextRequest, path: string) {
  const url = new URL(path, req.url);
  if (url.hostname === '0.0.0.0') url.hostname = 'localhost';
  return url;
}

export async function GET(req: NextRequest) {
  const expected = req.cookies.get('alter_one_oauth_state')?.value;
  const state = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error || !expected || !state || expected !== state || !code) return NextResponse.redirect(appUrl(req, `/login?error=alter_auth_failed&reason=${error ? 'provider_denied' : 'state'}`));
  try {
    const profile = await alterOneProfile(code);
    let userId: string;
    const existing = await database().select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1);
    if (existing[0]) userId = existing[0].id;
    else {
      userId = randomUUID();
      const actorId = randomUUID();
      const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
      await database().transaction(async (tx) => {
        await tx.insert(actors).values({ id: actorId, handle: `@${profile.email.split('@')[0]}-${userId.slice(0, 6)}`, display_name: profile.name, type: 'HUMAN', capabilities: ['review', 'merge'], status: 'IDLE', owner_user_id: userId });
        await tx.insert(users).values({ id: userId, actor_id: actorId, name: profile.name, email: profile.email, password_hash: passwordHash });
        await tx.insert(workspaces).values({ id: userId, name: 'My workspace', created_by: userId });
        await tx.insert(workspaceMembers).values({ id: randomUUID(), workspace_id: userId, user_id: userId, role: 'admin' });
      });
    }
    const token = await createSession(userId);
    await revokeSession(req.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.redirect(appUrl(req, '/'));
    response.cookies.delete('alter_one_oauth_state');
    setSessionCookie(response, req, token);
    return response;
  } catch (cause) {
    console.error('Alter One callback failed', cause instanceof Error ? cause.message : 'unknown error');
    const message = cause instanceof Error ? cause.message : '';
    const reason = message.includes('token') ? 'token' : message.includes('profile') || message.includes('email') ? 'profile' : 'account';
    return NextResponse.redirect(appUrl(req, `/login?error=alter_auth_failed&reason=${reason}`));
  }
}
