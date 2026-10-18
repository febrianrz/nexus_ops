import { actors, workspaces } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { hashKey } from './api';
import { membership, workspaceRoles } from './workspace-access';
import { requestUser } from './auth';
import { database } from './database';
import { developerKeyIdentity } from './developer-key-auth';
import { ProtocolError } from './protocol';
import { transact } from './store';
import type { Workspace } from './types';

export async function requestOwner(req: NextRequest): Promise<string | null> {
  const managed = developerKeyIdentity(req);
  if (managed) return managed.workspaceId;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    if (
      process.env.NEXUS_ADMIN_TOKEN &&
      hashKey(token) === hashKey(process.env.NEXUS_ADMIN_TOKEN)
    ) {
      const owner = req.headers.get('x-nexus-workspace') ?? req.headers.get('x-nexus-owner');
      if (!owner) return null;
      if (process.env.DATABASE_URL) {
        const [account] = await database()
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, owner))
          .limit(1);
        if (!account) throw new ProtocolError('Workspace not found', 404);
      }
      return owner;
    }
    if (
      (process.env.NEXUS_WORKER_TOKEN ?? process.env.NEXUS_ADMIN_TOKEN) &&
      hashKey(token) === hashKey(process.env.NEXUS_WORKER_TOKEN ?? process.env.NEXUS_ADMIN_TOKEN!)
    ) {
      const owner = req.headers.get('x-nexus-workspace');
      if (!owner) throw new ProtocolError('X-Nexus-Workspace is required for worker requests', 400);
      if (process.env.DATABASE_URL) {
        const [workspace] = await database()
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, owner))
          .limit(1);
        if (!workspace) throw new ProtocolError('Workspace not found', 404);
      }
      return owner;
    }
    if (!process.env.DATABASE_URL) return null;
    const [actor] = await database()
      .select({ owner: actors.workspace_id, status: actors.status })
      .from(actors)
      .where(and(eq(actors.api_key_hash, hashKey(token)), eq(actors.type, 'AGENT')))
      .limit(1);
    if (actor && actor.status !== 'OFFLINE') return actor.owner;
    throw new ProtocolError('A valid API token is required', 401);
  }
  const user = requestUser(req);
  if (!user) throw new ProtocolError('Please sign in to continue', 401);
  const workspace = await membership(user.id, req.headers.get('x-nexus-workspace') ?? undefined);
  workspaceRoles.set(req, workspace.role);
  return workspace.id;
}

export async function transactForRequest<T>(
  req: NextRequest,
  fn: (workspace: Workspace) => T | Promise<T>,
  signedWebhook = false,
): Promise<T> {
  const owner = signedWebhook
    ? (process.env.NEXUS_WEBHOOK_WORKSPACE_ID ?? process.env.NEXUS_WEBHOOK_OWNER_ID ?? null)
    : await requestOwner(req);
  return transact(fn, owner, signedWebhook ? undefined : requestUser(req)?.id, (role) =>
    workspaceRoles.set(req, role),
  );
}
