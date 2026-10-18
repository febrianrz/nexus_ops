import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, publicActor, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { requireWorkspaceAdmin } from '@/lib/workspace-access';
import { assignTask } from '@/lib/task-assignment';
const avatar = z.string().nullable().refine((value) => !value || /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value), 'Avatar must be a PNG, JPEG, WebP, or GIF image').refine((value) => !value || value.length <= 1400000, 'Avatar must be 1 MB or smaller');
const fields = { name: z.string().trim().min(2).max(80), username: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{0,39}$/, 'Use 1–40 lowercase letters, numbers, underscores or hyphens, starting with a letter'), avatar_url: avatar.default(null) };
const input = z.discriminatedUnion('action', [z.object({ action: z.literal('create'), ...fields }).strict(), z.object({ action: z.literal('update'), id: z.string().min(1), ...fields }).strict(), z.object({ action: z.literal('delete'), id: z.string().min(1) }).strict()]);
export async function GET(req: NextRequest) {
  return route(req, () => transact(req, (w) => { authenticate(req, w); return { agents: w.actors.filter((a) => a.type === 'AGENT' && a.status !== 'OFFLINE').map(publicActor) }; }));
}
export async function POST(req: NextRequest) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    return transact(req, (w) => {
      const caller = authenticate(req, w); requireWorkspaceAdmin(req);
      if (body.action === 'create') {
        if (w.actors.some((a) => a.handle === `@${body.username}`)) throw new ProtocolError('This username is already used in this workspace', 409);
        const agent = { id: randomUUID(), handle: `@${body.username}`, display_name: body.name, type: 'AGENT' as const, avatar_url: body.avatar_url, parent_agent_id: null, capabilities: [], webhook_url: null, api_key_hash: null, status: 'IDLE' as const, created_at: new Date().toISOString() };
        w.actors.push(agent); return { agent: publicActor(agent) };
      }
      const agent = w.actors.find((a) => a.id === body.id && a.type === 'AGENT' && a.status !== 'OFFLINE');
      if (!agent) throw new ProtocolError('Agent not found', 404);
      if (body.action === 'update') {
        if (w.actors.some((a) => a.id !== agent.id && a.handle === `@${body.username}`)) throw new ProtocolError('This username is already used in this workspace', 409);
        const renamed = agent.handle !== `@${body.username}`;
        agent.handle = `@${body.username}`; agent.display_name = body.name; agent.avatar_url = body.avatar_url;
        if (renamed) for (const task of w.tasks.filter((t) => t.assignee_id === agent.id)) { assignTask(w, task, agent.id); event(w, task, caller, 'COMMENT', `Agent username changed to ${agent.handle}.`); }
      } else {
        for (const task of w.tasks.filter((t) => t.assignee_id === agent.id)) { assignTask(w, task, null); event(w, task, caller, 'COMMENT', `Assignment cleared: ${agent.display_name} was removed.`); }
        agent.status = 'OFFLINE';
        agent.handle = `@removed-${agent.id}`;
      }
      return { agent: publicActor(agent) };
    });
  });
}
