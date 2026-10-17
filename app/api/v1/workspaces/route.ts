import { users, workspaceInvitations, workspaceMembers, workspaces } from '@/db/schema';
import { route } from '@/lib/api';
import { database } from '@/lib/database';
import { ProtocolError } from '@/lib/protocol';
import { signedIn } from '@/lib/workspace-access';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const role = z.enum(['admin', 'member']);
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(2).max(80) }).strict(),
  z
    .object({
      action: z.literal('rename'),
      workspace_id: z.string().min(1),
      name: z.string().trim().min(2).max(80),
    })
    .strict(),
  z
    .object({
      action: z.literal('invite'),
      workspace_id: z.string().min(1),
      email: z.email().trim().toLowerCase().max(254),
      role,
    })
    .strict(),
  z
    .object({ action: z.literal('respond'), invitation_id: z.string().uuid(), accept: z.boolean() })
    .strict(),
  z
    .object({
      action: z.literal('role'),
      workspace_id: z.string().min(1),
      user_id: z.string().min(1),
      role,
    })
    .strict(),
  z
    .object({
      action: z.literal('remove'),
      workspace_id: z.string().min(1),
      user_id: z.string().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('revoke'),
      workspace_id: z.string().min(1),
      invitation_id: z.string().uuid(),
    })
    .strict(),
]);
export async function GET(req: NextRequest) {
  return route(req, async () => {
    const user = signedIn(req);
    const db = database();
    const [list, invitations] = await Promise.all([
      db
        .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspace_id))
        .where(eq(workspaceMembers.user_id, user.id))
        .orderBy(asc(workspaces.created_at)),
      db
        .select({
          id: workspaceInvitations.id,
          workspace_id: workspaces.id,
          workspace_name: workspaces.name,
          role: workspaceInvitations.role,
          expires_at: workspaceInvitations.expires_at,
        })
        .from(workspaceInvitations)
        .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspace_id))
        .where(
          and(
            eq(workspaceInvitations.email, user.email),
            gt(workspaceInvitations.expires_at, new Date().toISOString()),
          ),
        ),
    ]);
    const requested = req.headers.get('x-nexus-workspace');
    const selected =
      list.find((entry) => entry.id === requested) ??
      list.find((entry) => entry.id === user.id) ??
      list[0] ??
      null;
    const members = selected
      ? await db
          .select({
            user_id: users.id,
            name: users.name,
            email: users.email,
            role: workspaceMembers.role,
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(users.id, workspaceMembers.user_id))
          .where(eq(workspaceMembers.workspace_id, selected.id))
          .orderBy(asc(workspaceMembers.created_at))
      : [];
    const pending =
      selected?.role === 'admin'
        ? await db
            .select({
              id: workspaceInvitations.id,
              email: workspaceInvitations.email,
              role: workspaceInvitations.role,
              expires_at: workspaceInvitations.expires_at,
            })
            .from(workspaceInvitations)
            .where(
              and(
                eq(workspaceInvitations.workspace_id, selected.id),
                gt(workspaceInvitations.expires_at, new Date().toISOString()),
              ),
            )
        : [];
    return { workspaces: list, invitations, current: selected, members, pending };
  });
}
export async function POST(req: NextRequest) {
  return route(req, async () => {
    const user = signedIn(req);
    const body = input.parse(await req.json());
    return database().transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(18271001)`);
      if (body.action === 'create') {
        const workspace = { id: randomUUID(), name: body.name, created_by: user.id };
        await tx.insert(workspaces).values(workspace);
        await tx.insert(workspaceMembers).values({
          id: randomUUID(),
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'admin',
        });
        return { workspace };
      }
      if (body.action === 'respond') {
        const [invitation] = await tx
          .select()
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.id, body.invitation_id),
              eq(workspaceInvitations.email, user.email),
              gt(workspaceInvitations.expires_at, new Date().toISOString()),
            ),
          );
        if (!invitation) throw new ProtocolError('This invitation is unavailable or expired', 404);
        if (body.accept)
          await tx
            .insert(workspaceMembers)
            .values({
              id: randomUUID(),
              workspace_id: invitation.workspace_id,
              user_id: user.id,
              role: invitation.role,
            })
            .onConflictDoNothing();
        await tx.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitation.id));
        return { accepted: body.accept, workspace_id: invitation.workspace_id };
      }
      const [caller] = await tx
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspace_id, body.workspace_id),
            eq(workspaceMembers.user_id, user.id),
          ),
        );
      if (caller?.role !== 'admin')
        throw new ProtocolError('Only workspace admins can manage this workspace', 403);
      if (body.action === 'rename') {
        await tx
          .update(workspaces)
          .set({ name: body.name })
          .where(eq(workspaces.id, body.workspace_id));
      } else if (body.action === 'invite') {
        const [recipient] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, body.email));
        if (!recipient)
          throw new ProtocolError(
            'This email has no account yet. Ask your teammate to register first.',
            422,
          );
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(workspaceMembers, eq(users.id, workspaceMembers.user_id))
          .where(
            and(eq(users.email, body.email), eq(workspaceMembers.workspace_id, body.workspace_id)),
          );
        if (existing) throw new ProtocolError('This user is already a workspace member', 409);
        const [pending] = await tx
          .select()
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspace_id, body.workspace_id),
              eq(workspaceInvitations.email, body.email),
            ),
          );
        if (pending && new Date(pending.expires_at).getTime() > Date.now())
          throw new ProtocolError('An invitation is already pending for this email', 409);
        await tx
          .insert(workspaceInvitations)
          .values({
            id: randomUUID(),
            workspace_id: body.workspace_id,
            email: body.email,
            role: body.role,
            invited_by: user.id,
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          })
          .onConflictDoUpdate({
            target: [workspaceInvitations.workspace_id, workspaceInvitations.email],
            set: {
              role: body.role,
              invited_by: user.id,
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            },
          });
      } else if (body.action === 'revoke') {
        const removed = await tx
          .delete(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspace_id, body.workspace_id),
              eq(workspaceInvitations.id, body.invitation_id),
            ),
          )
          .returning();
        if (!removed.length) throw new ProtocolError('Invitation not found', 404);
      } else {
        const members = await tx
          .select()
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspace_id, body.workspace_id));
        const target = members.find((entry) => entry.user_id === body.user_id);
        if (!target) throw new ProtocolError('Member not found', 404);
        if (
          target.role === 'admin' &&
          (body.action === 'remove' || body.role === 'member') &&
          members.filter((entry) => entry.role === 'admin').length === 1
        )
          throw new ProtocolError('A workspace must keep at least one admin', 409);
        if (body.action === 'remove')
          await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, target.id));
        else
          await tx
            .update(workspaceMembers)
            .set({ role: body.role })
            .where(eq(workspaceMembers.id, target.id));
      }
      return { ok: true };
    });
  });
}
