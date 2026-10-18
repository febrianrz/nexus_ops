import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { database } from './database';
import { ProtocolError } from './protocol';
import { membership, signedIn } from './workspace-access';

export async function attachmentTask(req: NextRequest, taskId: string) {
  const user = signedIn(req);
  const [task] = await database().select({ id: tasks.id, workspace_id: tasks.workspace_id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task?.workspace_id) throw new ProtocolError('Task not found', 404);
  await membership(user.id, task.workspace_id);
  return { task, user };
}
