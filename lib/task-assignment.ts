import { ProtocolError } from './protocol';
import type { Actor, Task, Workspace } from './types';

export function assignTask(workspace: Workspace, task: Task, assigneeId: string | null) {
  const assignee = assigneeId ? workspace.actors.find((actor) => actor.id === assigneeId && (actor.type === 'HUMAN' || actor.status !== 'OFFLINE')) : undefined;
  if (assigneeId && !assignee) throw new ProtocolError('Assignee not found in this workspace', 404);
  const wasAgent = task.is_agent_task;
  task.assignee_id = assignee?.id ?? null;
  task.is_agent_task = assignee?.type === 'AGENT';
  task.agent_key = task.is_agent_task ? assignee!.handle.replace(/^@/, '') : null;
  task.lock_token = null;
  task.live_activity_text = null;
  if (task.state !== 'DONE' && (wasAgent || task.is_agent_task)) task.state = task.is_agent_task ? 'QUEUED' : 'TRIAGE';
  task.updated_at = new Date().toISOString();
}

export function agentUsername(actor: Actor) { return actor.handle.replace(/^@/, ''); }
