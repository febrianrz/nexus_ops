import { developerKeys } from '@/db/schema';
import { route } from '@/lib/api';
import { hashDeveloperKey } from '@/lib/developer-key-auth';
import { database } from '@/lib/database';
import { ProtocolError } from '@/lib/protocol';
import { membership, signedIn } from '@/lib/workspace-access';
import { and, desc, eq } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(2).max(80), expires_in_days: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90) }).strict(),
  z.object({ action: z.literal('revoke'), key_id: z.string().uuid() }).strict(),
]);
const fields = { id: developerKeys.id, name: developerKeys.name, prefix: developerKeys.prefix, created_at: developerKeys.created_at, expires_at: developerKeys.expires_at, last_used_at: developerKeys.last_used_at, revoked_at: developerKeys.revoked_at };
async function adminWorkspace(req: NextRequest) {
  const user = signedIn(req);
  const workspace = await membership(user.id, req.headers.get('x-nexus-workspace') ?? undefined);
  if (workspace.role !== 'admin') throw new ProtocolError('Only workspace admins can manage API keys', 403);
  return { user, workspace };
}
export async function GET(req: NextRequest) {
  return route(req, async () => {
    const { workspace } = await adminWorkspace(req);
    return { keys: await database().select(fields).from(developerKeys).where(eq(developerKeys.workspace_id, workspace.id)).orderBy(desc(developerKeys.created_at)) };
  });
}
export async function POST(req: NextRequest) {
  return route(req, async () => {
    const { user, workspace } = await adminWorkspace(req);
    const body = input.parse(await req.json());
    if (body.action === 'revoke') {
      const rows = await database().update(developerKeys).set({ revoked_at: new Date().toISOString() }).where(and(eq(developerKeys.id, body.key_id), eq(developerKeys.workspace_id, workspace.id))).returning({ id: developerKeys.id });
      if (!rows.length) throw new ProtocolError('API key not found', 404);
      return { revoked: true };
    }
    const token = `nxo_${randomBytes(32).toString('hex')}`;
    const [key] = await database().insert(developerKeys).values({ id: randomUUID(), workspace_id: workspace.id, created_by: user.id, name: body.name, prefix: token.slice(0, 12), token_hash: hashDeveloperKey(token), expires_at: new Date(Date.now() + body.expires_in_days * 86400000).toISOString() }).returning(fields);
    return NextResponse.json({ key, token }, { status: 201 });
  });
}
