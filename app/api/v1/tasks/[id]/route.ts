import { authenticate, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
const input = z
  .object({
    action: z.enum(['approve', 'resume', 'queue']),
    title: z.string().min(3).max(180).optional(),
  })
  .strict();
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      const actor = authenticate(req, w, true);
      const task = w.tasks.find((t) => t.id === id);
      if (!task) throw new ProtocolError('Task not found', 404);
      if (body.action === 'approve' && task.state !== 'WAITING_HUMAN')
        throw new ProtocolError('Only tasks awaiting human review can be approved', 409);
      task.state =
        body.action === 'approve' ? 'DONE' : body.action === 'queue' ? 'QUEUED' : 'EXECUTING';
      if (body.action === 'resume') {
        task.hop_count = 0;
        task.lock_token = null;
      }
      if (body.title) task.title = body.title;
      task.live_activity_text =
        body.action === 'approve' ? null : 'Human reviewed · ready to continue';
      const assignee = w.actors.find((candidate) => candidate.id === task.assignee_id);
      if (assignee?.type === 'AGENT') {
        assignee.status = w.tasks.some(
          (candidate) => candidate.assignee_id === assignee.id && candidate.state === 'EXECUTING',
        )
          ? 'EXECUTING'
          : 'IDLE';
      }
      event(
        w,
        task,
        actor,
        'STATE_CHANGE',
        body.action === 'approve'
          ? `Approved & marked complete by ${actor.display_name}. Repository merge must be performed in GitHub.`
          : body.action === 'resume'
            ? 'Human resumed execution and reset the circuit breaker.'
            : 'Task added to the queue.',
        { state: task.state },
      );
      return task;
    });
  });
}
