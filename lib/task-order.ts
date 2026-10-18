import type { Task } from './types';

export function sortTasks(tasks: Task[]): Task[] {
  const rank = (task: Task) => typeof task.context_payload.sort_order === 'number' ? task.context_payload.sort_order : Number.MAX_SAFE_INTEGER;
  return [...tasks].sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const statusGroup = (task: Task) => task.state === 'QUEUED' ? 'TRIAGE' : task.state === 'BLOCKED' ? 'WAITING_HUMAN' : task.state;
export function canReorderTask(task: Task, target: Task): boolean {
  return task.id !== target.id && task.project_id === target.project_id && task.parent_task_id === target.parent_task_id && (Boolean(task.parent_task_id) || statusGroup(task) === statusGroup(target));
}

export function reorderTaskList(tasks: Task[], task: Task, target: Task, placement: 'before' | 'after'): Task[] {
  const siblings = sortTasks(tasks.filter((item) => item.project_id === task.project_id && item.parent_task_id === task.parent_task_id)).filter((item) => item.id !== task.id);
  const index = siblings.findIndex((item) => item.id === target.id);
  siblings.splice(index + (placement === 'after' ? 1 : 0), 0, task);
  const ranks = new Map(siblings.map((item, position) => [item.id, position]));
  return sortTasks(tasks.map((item) => ranks.has(item.id) ? { ...item, context_payload: { ...item.context_payload, sort_order: ranks.get(item.id)! } } : item));
}
