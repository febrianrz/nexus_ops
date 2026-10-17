import { authenticate, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const body = z
      .object({ message: z.string().trim().min(1).max(5000) })
      .strict()
      .parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      const actor = authenticate(req, w);
      const task = w.tasks.find((t) => t.id === id);
      if (!task) throw new ProtocolError('Task not found', 404);
      if (actor.type === 'AGENT' && task.assignee_id !== actor.id)
        throw new ProtocolError('Agent is not assigned to this task', 403);
      return event(
        w,
        task,
        actor,
        'COMMENT',
        body.message,
        {},
        body.message.match(/@[a-z][a-z0-9-]+/g) ?? [],
      );
    });
  });
}
