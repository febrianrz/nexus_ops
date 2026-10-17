import { authenticate, route } from '@/lib/api';
import { delegate, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
const input = z
  .object({
    target_handle: z
      .string()
      .regex(/^@[a-z][a-z0-9-]+$/)
      .optional(),
    message: z.string().max(5000).default(''),
  })
  .strict();
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      const caller = authenticate(req, w);
      const task = w.tasks.find((t) => t.id === id);
      if (!task) throw new ProtocolError('Task not found', 404);
      const target = body.target_handle ?? body.message.match(/@[a-z][a-z0-9-]+/)?.[0];
      if (!target) throw new ProtocolError('Include a target_handle or @mention');
      return delegate(w, task, caller, target, body.message);
    });
  });
}
