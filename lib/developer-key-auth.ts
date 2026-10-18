import { developerKeys, users, workspaceMembers } from '@/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { database } from './database';
import { ProtocolError } from './protocol';

const identities = new WeakMap<NextRequest, { workspaceId: string; actorId: string }>();
export const developerKeyIdentity = (req: NextRequest) => identities.get(req);
export const hashDeveloperKey = (token: string) => createHash('sha256').update(token).digest('hex');
export async function prepareDeveloperKey(req: NextRequest, token: string) {
  if (!process.env.DATABASE_URL || !/^nxo_[a-f0-9]{64}$/.test(token)) throw new ProtocolError('Invalid API key', 401);
  const [key] = await database().select({ id: developerKeys.id, workspaceId: developerKeys.workspace_id, actorId: users.actor_id }).from(developerKeys)
    .innerJoin(users, eq(users.id, developerKeys.created_by))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspace_id, developerKeys.workspace_id), eq(workspaceMembers.user_id, developerKeys.created_by)))
    .where(and(eq(developerKeys.token_hash, hashDeveloperKey(token)), isNull(developerKeys.revoked_at), gt(developerKeys.expires_at, new Date().toISOString()), eq(workspaceMembers.role, 'admin'))).limit(1);
  if (!key) throw new ProtocolError('API key is invalid, expired, revoked, or its creator no longer has admin access', 401);
  const requested = req.headers.get('x-nexus-workspace') ?? req.headers.get('x-nexus-owner');
  if (requested && requested !== key.workspaceId) throw new ProtocolError('API key cannot access another workspace', 403);
  identities.set(req, { workspaceId: key.workspaceId, actorId: key.actorId });
  await database().update(developerKeys).set({ last_used_at: new Date().toISOString() }).where(eq(developerKeys.id, key.id));
}
