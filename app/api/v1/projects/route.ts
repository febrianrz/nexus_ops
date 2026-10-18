import { authenticate, route } from '@/lib/api';
import { requestUser } from '@/lib/auth';
import { requestOwner, transactForRequest as transact } from '@/lib/workspace-scope';
import { ProtocolError } from '@/lib/protocol';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const input = z
  .object({ name: z.string().trim().min(2).max(80), description: z.string().max(500).default('') })
  .strict();

export async function POST(req: NextRequest) {
  return route(req, async () => {
    const body = input.parse(await req.json());
    const workspaceId = await requestOwner(req);
    if (!workspaceId) throw new ProtocolError('Workspace not found', 404);
    return transact(req, async (workspace) => {
      authenticate(req, workspace, true);
      const project = {
        id: randomUUID(),
        workspace_id: workspaceId,
        name: body.name,
        description: body.description,
        created_by: requestUser(req)?.id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (workspace.projects.some((item) => item.name.toLowerCase() === project.name.toLowerCase()))
        throw new ProtocolError('A project with this name already exists', 409);
      workspace.projects.push(project);
      return { project };
    });
  });
}
