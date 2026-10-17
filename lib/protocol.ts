import { randomUUID } from 'node:crypto';
import type { Actor, Task, TaskEvent, Workspace } from './types';
export class ProtocolError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function event(
  w: Workspace,
  task: Task,
  actor: Actor,
  type: TaskEvent['event_type'],
  message: string,
  payload: Record<string, unknown> = {},
  handles: string[] = [],
) {
  const e: TaskEvent = {
    id: randomUUID(),
    task_id: task.id,
    actor_id: actor.id,
    event_type: type,
    human_message: message,
    mentioned_handles: handles,
    structured_payload: payload,
    created_at: new Date().toISOString(),
  };
  w.events.push(e);
  task.updated_at = e.created_at;
  return e;
}
export function delegate(
  w: Workspace,
  task: Task,
  actor: Actor,
  targetHandle: string,
  message: string,
) {
  if (task.state === 'DONE') throw new ProtocolError('Completed tasks cannot be delegated', 409);
  if (actor.type === 'AGENT' && task.assignee_id !== actor.id)
    throw new ProtocolError('Only the assigned agent can delegate', 403);
  if (task.hop_count >= task.max_hops)
    throw new ProtocolError('Circuit breaker is open. Human intervention is required.', 409);
  const target = w.actors.find((a) => a.handle === targetHandle);
  if (!target) throw new ProtocolError('Target actor not found', 404);
  if (target.id === task.assignee_id)
    throw new ProtocolError('Choose a different actor for the handoff', 409);
  if (target.status === 'OFFLINE') throw new ProtocolError('Target actor is offline', 409);
  const previous = w.actors.find((a) => a.id === task.assignee_id);
  task.hop_count += 1;
  if (task.hop_count >= task.max_hops) {
    task.state = 'WAITING_HUMAN';
    task.lock_token = null;
    task.live_activity_text = 'Circuit breaker tripped · human intervention required';
    event(
      w,
      task,
      actor,
      'CIRCUIT_BREAKER',
      'Maximum delegation depth reached. Execution paused for human review.',
      { hop_count: task.hop_count, max_hops: task.max_hops },
      ['@admin'],
    );
  } else {
    task.delegated_by_id = task.assignee_id;
    task.assignee_id = target.id;
    task.lock_token = null;
    task.state = target.type === 'HUMAN' ? 'WAITING_HUMAN' : 'EXECUTING';
    task.live_activity_text = target.type === 'AGENT' ? 'Reviewing task context' : null;
    target.status = target.type === 'AGENT' ? 'EXECUTING' : target.status;
    event(
      w,
      task,
      actor,
      'DELEGATION',
      message || `Delegated to ${target.handle}`,
      { target_handle: target.handle, hop_count: task.hop_count },
      [target.handle],
    );
  }
  if (
    previous?.type === 'AGENT' &&
    !w.tasks.some((t) => t.assignee_id === previous.id && t.state === 'EXECUTING')
  )
    previous.status = 'IDLE';
  return task;
}
