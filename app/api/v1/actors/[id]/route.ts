import { requireWorkspaceAdmin } from '@/lib/workspace-access';
import { authenticate, publicActor, route } from '@/lib/api';
import { ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { status } = z
      .object({ status: z.enum(['IDLE', 'EXECUTING', 'OFFLINE']) })
      .strict()
      .parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      authenticate(req, w, true);
      requireWorkspaceAdmin(req);
      const actor = w.actors.find((a) => a.id === id && a.type === 'AGENT');
      if (!actor) throw new ProtocolError('Agent not found', 404);
      actor.status = status;
      return publicActor(actor);
    });
  });
}
