import type { Task } from './types';

export function planningDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

export function taskCompletion(task: Task, tasks: Task[]): number {
  const children = new Map<string, Task[]>();
  tasks.forEach((item) => {
    if (item.parent_task_id) children.set(item.parent_task_id, [...(children.get(item.parent_task_id) ?? []), item]);
  });
  const leaves = (item: Task): Task[] => {
    const nested = children.get(item.id) ?? [];
    return nested.length ? nested.flatMap(leaves) : [item];
  };
  const terminal = leaves(task);
  return Math.round(terminal.reduce((sum, item) => {
    if (item.state === 'DONE') return sum + 100;
    const checklist = item.context_payload.checklist;
    if (Array.isArray(checklist) && checklist.length > 0) {
      return sum + Math.round((checklist.filter((entry) => entry.completed).length / checklist.length) * 100);
    }
    const manual = item.context_payload.completion;
    return sum + (typeof manual === 'number' ? Math.min(100, Math.max(0, manual)) : 0);
  }, 0) / terminal.length);
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isOverdue(task: Task): boolean {
  const due = planningDate(task.context_payload.due_date);
  return Boolean(due && due < localDate() && task.state !== 'DONE');
}

export function formatPlanningDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
