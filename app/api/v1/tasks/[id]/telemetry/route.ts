import { authenticate, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
const input = z
  .object({
    live_activity_text: z.string().max(200).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    state: z.enum(['EXECUTING', 'WAITING_HUMAN']).optional(),
    lock_token: z.string().optional(),
    tool_call: z.object({ name: z.string().max(100), output: z.string().max(10000) }).optional(),
  })
  .strict();
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      const caller = authenticate(req, w);
      const task = w.tasks.find((t) => t.id === id);
      if (!task) throw new ProtocolError('Task not found', 404);
      if (caller.type === 'AGENT' && task.assignee_id !== caller.id)
        throw new ProtocolError('Only the assigned agent may update telemetry', 403);
      if (task.state === 'DONE' || task.hop_count >= task.max_hops)
        throw new ProtocolError('Execution is locked; human intervention is required', 409);
      if (task.lock_token && task.lock_token !== body.lock_token)
        throw new ProtocolError('Lock token mismatch', 409);
      if (body.live_activity_text !== undefined) task.live_activity_text = body.live_activity_text;
      if (body.confidence_score !== undefined) task.confidence_score = body.confidence_score;
      if (body.state) {
        task.state = body.state;
        event(w, task, caller, 'STATE_CHANGE', `Moved task to ${body.state}`, {
          state: body.state,
        });
      }
      if (body.tool_call)
        event(w, task, caller, 'TOOL_CALL_LOG', body.tool_call.output, {
          tool: body.tool_call.name,
        });
      task.updated_at = new Date().toISOString();
      return task;
    });
  });
}
