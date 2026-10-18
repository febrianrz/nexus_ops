import * as schema from '@/db/schema';
import { and, eq, inArray, isNull, or, sql as schemaSQL } from 'drizzle-orm';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedWorkspace } from './seed';
import { database } from './database';
import { ProtocolError } from './protocol';
import type { Workspace } from './types';
const globals = globalThis as unknown as {
  nexusQueue?: Promise<unknown>;
};
const file = path.join(
  process.env.NEXUS_DATA_DIR ?? path.join(process.cwd(), '.data'),
  'workspace.json',
);
async function localRead(): Promise<Workspace> {
  try {
    const workspace = JSON.parse(await readFile(file, 'utf8')) as Workspace;
    workspace.projects ??= [];
    for (const task of workspace.tasks) {
      task.project_id ??= workspace.projects[0]?.id ?? null;
      task.parent_task_id ??= null;
      task.is_agent_task ??= false;
      task.agent_key ??= null;
    }
    return workspace;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return seedWorkspace();
  }
}
export async function transact<T>(
  fn: (workspace: Workspace) => T | Promise<T>,
  ownerId: string | null = null,
  userId?: string,
  onRole?: (role: 'admin' | 'member') => void,
): Promise<T> {
  const run = async () => {
    if (process.env.DATABASE_URL)
      return database().transaction(async (tx) => {
        await tx.execute(schemaSQL`SELECT pg_advisory_xact_lock(18271001)`);
        if (userId && ownerId) {
          const [member] = await tx
            .select()
            .from(schema.workspaceMembers)
            .where(
              and(
                eq(schema.workspaceMembers.user_id, userId),
                eq(schema.workspaceMembers.workspace_id, ownerId),
              ),
            );
          if (!member)
            throw new ProtocolError(
              'Workspace access was removed. Switch to another workspace.',
              403,
            );
          onRole?.(member.role);
        }
        const [workspace] = ownerId
          ? await tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, ownerId))
          : [];
        if (ownerId && !workspace) throw new ProtocolError('Workspace not found', 404);
        const humans = ownerId
          ? tx
              .select({ id: schema.users.actor_id })
              .from(schema.users)
              .innerJoin(
                schema.workspaceMembers,
                eq(schema.workspaceMembers.user_id, schema.users.id),
              )
              .where(eq(schema.workspaceMembers.workspace_id, ownerId))
          : undefined;
        const [actors, tasks, events, projects] = await Promise.all([
          tx
            .select()
            .from(schema.actors)
            .where(
              ownerId
                ? or(
                    eq(schema.actors.workspace_id, ownerId),
                    and(eq(schema.actors.type, 'HUMAN'), inArray(schema.actors.id, humans!)),
                  )
                : and(isNull(schema.actors.workspace_id), isNull(schema.actors.owner_user_id)),
            ),
          tx
            .select()
            .from(schema.tasks)
            .where(
              ownerId ? eq(schema.tasks.workspace_id, ownerId) : isNull(schema.tasks.workspace_id),
            ),
          tx
            .select()
            .from(schema.taskEvents)
            .where(
              ownerId
                ? eq(schema.taskEvents.workspace_id, ownerId)
                : isNull(schema.taskEvents.workspace_id),
            ),
          ownerId
            ? tx.select().from(schema.projects).where(eq(schema.projects.workspace_id, ownerId))
            : Promise.resolve([]),
        ]);
        const [sequence] = await tx.execute<{ next: number }>(
          schemaSQL`SELECT COALESCE(MAX(CASE WHEN id ~ '^NEX-[0-9]+$' THEN substring(id from 5)::integer END), 100) + 1 AS next FROM tasks`,
        );
        const state = {
          actors,
          tasks,
          events,
          projects,
          next_task_id: `NEX-${sequence.next}`,
        } as Workspace;
        const result = await fn(state);
        for (const a of state.actors) {
          if (ownerId && a.type === 'HUMAN') continue;
          await tx
            .insert(schema.actors)
            .values({ ...a, owner_user_id: workspace?.created_by ?? null, workspace_id: ownerId })
            .onConflictDoUpdate({
              target: schema.actors.id,
              set: { ...a, workspace_id: ownerId },
              setWhere: ownerId
                ? eq(schema.actors.workspace_id, ownerId)
                : and(isNull(schema.actors.workspace_id), isNull(schema.actors.owner_user_id)),
            });
        }
        for (const t of state.tasks)
          await tx
            .insert(schema.tasks)
            .values({
              ...t,
              project_id: ownerId ? t.project_id : null,
              owner_user_id: workspace?.created_by ?? null,
              workspace_id: ownerId,
            })
            .onConflictDoUpdate({
              target: schema.tasks.id,
              set: { ...t, workspace_id: ownerId },
              setWhere: ownerId
                ? eq(schema.tasks.workspace_id, ownerId)
                : isNull(schema.tasks.workspace_id),
            });
        if (ownerId)
          for (const project of state.projects)
            await tx
              .insert(schema.projects)
              .values({ ...project, workspace_id: ownerId })
              .onConflictDoUpdate({
                target: schema.projects.id,
                set: { ...project },
                setWhere: eq(schema.projects.workspace_id, ownerId),
              });
        for (const e of state.events)
          await tx
            .insert(schema.taskEvents)
            .values({ ...e, owner_user_id: workspace?.created_by ?? null, workspace_id: ownerId })
            .onConflictDoNothing();
        return result;
      });
    if (ownerId) throw new Error('PostgreSQL is required for account workspace isolation');
    if (process.env.NODE_ENV === 'production' && process.env.NEXUS_DEMO_MODE !== 'true')
      throw new Error('DATABASE_URL is required outside demo mode');
    const state = await localRead();
    const result = await fn(state);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file + '.tmp', JSON.stringify(state, null, 2));
    await rename(file + '.tmp', file);
    return result;
  };
  const pending = (globals.nexusQueue ?? Promise.resolve()).then(run, run);
  globals.nexusQueue = pending.catch(() => {});
  return pending;
}
export const getWorkspace = () => transact((w) => structuredClone(w));
