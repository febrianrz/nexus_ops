import { actors, users, workspaces, workspaceMembers } from '@/db/schema';
import { route } from '@/lib/api';
import {
  assertSameOrigin,
  createSession,
  limitAuthentication,
  revokeSession,
  SESSION_COOKIE,
  setSessionCookie,
} from '@/lib/auth';
import { registerInput } from '@/lib/auth-validation';
import { database } from '@/lib/database';
import { hashPassword } from '@/lib/password';
import { ProtocolError } from '@/lib/protocol';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return route(req, async () => {
    assertSameOrigin(req);
    const body = registerInput.parse(await req.json());
    await limitAuthentication('register:global', 20, 60);
    const passwordHash = await hashPassword(body.password);
    const id = randomUUID();
    const actorId = randomUUID();
    const slug =
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24) || 'human';
    const user = { id, name: body.name, email: body.email, actorId };
    try {
      await database().transaction(async (tx) => {
        await tx.insert(actors).values({
          id: actorId,
          handle: `@${/^[a-z]/.test(slug) ? slug : `human-${slug}`}-${id.slice(0, 6)}`,
          display_name: body.name,
          type: 'HUMAN',
          capabilities: ['review', 'merge'],
          status: 'IDLE',
        });
        await tx.insert(users).values({
          id,
          actor_id: actorId,
          name: body.name,
          email: body.email,
          password_hash: passwordHash,
        });
        await tx.insert(workspaces).values({ id, name: 'My workspace', created_by: id });
        await tx
          .insert(workspaceMembers)
          .values({ id: randomUUID(), workspace_id: id, user_id: id, role: 'admin' });
        await tx.update(actors).set({ owner_user_id: id }).where(eq(actors.id, actorId));
      });
    } catch (error) {
      if (
        (error as { code?: string }).code === '23505' ||
        (error as { cause?: { code?: string } }).cause?.code === '23505'
      )
        throw new ProtocolError('An account with this email already exists. Please sign in.', 409);
      throw error;
    }
    const token = await createSession(id);
    await revokeSession(req.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, req, token);
    return response;
  });
}
