import { requireWorkspaceAdmin } from '@/lib/workspace-access';
import { authenticate, hashKey, publicActor, route } from '@/lib/api';
import { ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
const input = z
  .object({
    handle: z.string().regex(/^@[a-z][a-z0-9-]{2,40}$/),
    display_name: z.string().min(2).max(80),
    capabilities: z.array(z.string().min(1).max(40)).max(12).default([]),
    parent_agent_id: z.string().nullable().optional(),
    webhook_url: z.url().startsWith('https://').nullable().optional(),
  })
  .strict();
export async function POST(req: NextRequest) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    return transact(req, (w) => {
      const caller = authenticate(req, w);
      if (caller.type === 'HUMAN') requireWorkspaceAdmin(req);
      if (w.actors.some((a) => a.handle === body.handle))
        throw new ProtocolError('This handle is already registered', 409);
      if (caller.type === 'AGENT' && body.parent_agent_id !== caller.id)
        throw new ProtocolError('Agents may only spawn their own children', 403);
      if (
        body.parent_agent_id &&
        !w.actors.some((a) => a.id === body.parent_agent_id && a.type === 'AGENT')
      )
        throw new ProtocolError('Parent agent not found', 404);
      const token = `nxs_${randomBytes(32).toString('hex')}`;
      const actor = {
        id: randomUUID(),
        handle: body.handle,
        display_name: body.display_name,
        capabilities: body.capabilities,
        parent_agent_id: body.parent_agent_id ?? null,
        webhook_url: body.webhook_url ?? null,
        type: 'AGENT' as const,
        avatar_url: null,
        api_key_hash: hashKey(token),
        status: 'IDLE' as const,
        created_at: new Date().toISOString(),
      };
      w.actors.push(actor);
      return {
        actor: publicActor(actor),
        token,
        scope: ['assigned_tasks:delegate', 'assigned_tasks:telemetry', 'agents:spawn_children'],
      };
    });
  });
}
