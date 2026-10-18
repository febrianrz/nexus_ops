import { authenticateWorker, route } from '@/lib/api';
import { ProtocolError, event } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return route(req, async () => {
    const projectId = req.nextUrl.searchParams.get('project_id');
    const agentKey = req.nextUrl.searchParams.get('agent_key')?.toLowerCase();
    if (!projectId || !agentKey || !/^[a-z][a-z0-9_-]{0,39}$/.test(agentKey))
      throw new ProtocolError('project_id and a valid agent_key are required', 422);
    const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 5));
    return transact(req, (workspace) => {
      const caller = authenticateWorker(req, workspace);
      if (!caller) throw new ProtocolError('A valid service API token is required', 401);
      if (!workspace.projects.some((project) => project.id === projectId))
        throw new ProtocolError('Project not found in this workspace', 404);
      const tasks = workspace.tasks
        .filter(
          (task) =>
            task.project_id === projectId &&
            task.is_agent_task &&
            task.agent_key === agentKey &&
            task.state === 'QUEUED',
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, limit);
      const now = new Date().toISOString();
      for (const task of tasks) {
        task.state = 'EXECUTING';
        task.lock_token = randomUUID();
        task.live_activity_text = 'Claimed by external worker';
        task.updated_at = now;
        event(workspace, task, caller, 'STATE_CHANGE', `Claimed by external ${agentKey} worker`, {
          state: 'EXECUTING',
          agent_key: agentKey,
        });
      }
      return { tasks };
    });
  });
}
