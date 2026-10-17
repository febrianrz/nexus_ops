import { prepareAuthentication, requestUser } from './auth';
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { ProtocolError } from './protocol';
import type { Actor, Workspace } from './types';
export function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function equal(a: string, b: string) {
  const aa = Buffer.from(hashKey(a)),
    bb = Buffer.from(hashKey(b));
  return timingSafeEqual(aa, bb);
}
export function authenticate(req: NextRequest, w: Workspace, adminOnly = false): Actor {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const admin = w.actors.find((a) => a.id === 'admin') ?? w.actors.find((a) => a.type === 'HUMAN');
  if (
    token &&
    admin &&
    process.env.NEXUS_ADMIN_TOKEN &&
    equal(token, process.env.NEXUS_ADMIN_TOKEN)
  )
    return admin;
  if (token && !adminOnly) {
    const agent = w.actors.find((a) => a.api_key_hash && equal(a.api_key_hash, hashKey(token)));
    if (agent && agent.status !== 'OFFLINE') return agent;
  }
  const user = !token ? requestUser(req) : undefined;
  if (user) {
    const actor = w.actors.find(
      (candidate) => candidate.id === user.actorId && candidate.type === 'HUMAN',
    );
    if (actor) return actor;
  }
  throw new ProtocolError(
    adminOnly ? 'Human authentication required' : 'Please sign in to continue',
    401,
  );
}
export function publicActor(a: Actor) {
  const { api_key_hash, webhook_url, ...safe } = a;
  void api_key_hash;
  void webhook_url;
  return safe;
}
export async function route(req: NextRequest, fn: () => Promise<unknown>) {
  try {
    await prepareAuthentication(req);
    const result = await fn();
    const response = result instanceof NextResponse ? result : NextResponse.json(result);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 422 },
      );
    if (error instanceof ProtocolError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    console.error(error);
    return NextResponse.json(
      { error: 'Unable to complete the request. Check server configuration.' },
      { status: 500 },
    );
  }
}
