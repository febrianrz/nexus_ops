import { workspaceMembers, workspaces } from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { requestUser } from './auth';
import { database } from './database';
import { ProtocolError } from './protocol';

export const workspaceRoles = new WeakMap<NextRequest, 'admin' | 'member'>();
export function signedIn(req: NextRequest) {
  const user = requestUser(req);
  if (!user) throw new ProtocolError('Please sign in to continue', 401);
  return user;
}
export async function membership(userId: string, workspaceId?: string) {
  const [entry] = await database()
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspace_id))
    .where(
      and(
        eq(workspaceMembers.user_id, userId),
        workspaceId ? eq(workspaceMembers.workspace_id, workspaceId) : undefined,
      ),
    )
    .orderBy(
      sql`${workspaceMembers.workspace_id} = ${userId} DESC`,
      asc(workspaceMembers.created_at),
    )
    .limit(1);
  if (!entry) throw new ProtocolError('You do not have access to this workspace', 403);
  return entry;
}
export function requireWorkspaceAdmin(req: NextRequest) {
  if (requestUser(req) && workspaceRoles.get(req) !== 'admin')
    throw new ProtocolError('Only workspace admins can perform this action', 403);
}
