import { users } from '@/db/schema';
import { route } from '@/lib/api';
import {
  assertSameOrigin,
  createSession,
  limitAuthentication,
  revokeSession,
  SESSION_COOKIE,
  setSessionCookie,
} from '@/lib/auth';
import { loginInput } from '@/lib/auth-validation';
import { database } from '@/lib/database';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/lib/password';
import { ProtocolError } from '@/lib/protocol';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return route(req, async () => {
    assertSameOrigin(req);
    const body = loginInput.parse(await req.json());
    await limitAuthentication('login:global', 120, 60);
    await limitAuthentication(`login:${body.email}`, 10, 900);
    const [user] = await database()
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    const valid = await verifyPassword(body.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) throw new ProtocolError('Email or password is incorrect.', 401);
    const token = await createSession(user.id);
    await revokeSession(req.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, actorId: user.actor_id },
    });
    setSessionCookie(response, req, token);
    return response;
  });
}
