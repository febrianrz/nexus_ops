'use client';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import type { Task } from '@/lib/types';
import { canReorderTask, reorderTaskList, sortTasks } from '@/lib/task-order';

type Drop = { id: string; placement: 'before' | 'after' } | null;
const OrderContext = createContext<{
  dragged: string | null;
  drop: Drop;
  saving: boolean;
  setDragged: (id: string | null) => void;
  setDrop: (drop: Drop) => void;
  move: (task: Task, target: Task, placement: 'before' | 'after') => Promise<void>;
} | null>(null);

export function TaskOrderProvider({ children }: { children: ReactNode }) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  async function move(task: Task, target: Task, placement: 'before' | 'after') {
    if (busy.current || !canReorderTask(task, target)) return;
    busy.current = true;
    setSaving(true);
    setDragged(null);
    setDrop(null);
    const store = useWorkspace.getState();
    const workspaceId = store.workspaceId;
    useWorkspace.setState({ tasks: reorderTaskList(store.tasks, task, target, placement) });
    try {
      await api(`/tasks/${task.id}`, 'PATCH', { action: 'reorder', target_id: target.id, placement });
      if (useWorkspace.getState().workspaceId === workspaceId) await store.refresh();
      setAnnouncement(`${task.title} moved ${placement} ${target.title}. Order saved.`);
    } catch (error) {
      toast.error((error as Error).message);
      if (useWorkspace.getState().workspaceId === workspaceId) await store.refresh().catch(() => undefined);
    } finally { busy.current = false; setSaving(false); }
  }
  return <OrderContext.Provider value={{ dragged, drop, saving, setDragged, setDrop, move }}><span className="task-order-announcement" role="status">{announcement}</span>{children}</OrderContext.Provider>;
}

export function SortableTaskRow({ task, children }: { task: Task; children: ReactNode }) {
  const order = useContext(OrderContext)!;
  const tasks = useWorkspace((state) => state.tasks);
  const moving = tasks.find((item) => item.id === order.dragged);
  const valid = moving && canReorderTask(moving, task);
  const placement = order.drop?.id === task.id ? order.drop.placement : null;
  return <div className={`project-table-row sortable-task-row ${order.dragged === task.id ? 'is-dragging' : ''} ${placement ? `drop-${placement}` : ''}`} onDragOver={(event) => {
    if (!valid || order.saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    if (order.drop?.id !== task.id || order.drop.placement !== next) order.setDrop({ id: task.id, placement: next });
  }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && order.drop?.id === task.id) order.setDrop(null); }} onDrop={(event) => {
    event.preventDefault();
    if (valid && order.drop?.id === task.id) void order.move(moving, task, order.drop.placement);
  }}>
    <button className="task-drag-handle" draggable={!order.saving} aria-label={`Reorder ${task.title}. Drag or use Arrow Up and Arrow Down.`} aria-disabled={order.saving} title="Drag to reorder · ↑ ↓ to move" onDragStart={(event) => {
      if (order.saving) { event.preventDefault(); return; }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', task.id);
      order.setDragged(task.id);
    }} onDragEnd={() => { order.setDragged(null); order.setDrop(null); }} onKeyDown={(event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const siblings = sortTasks(tasks.filter((item) => item.id === task.id || canReorderTask(task, item)));
      const index = siblings.findIndex((item) => item.id === task.id);
      const target = siblings[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) void order.move(task, target, event.key === 'ArrowUp' ? 'before' : 'after');
    }}><GripVertical size={14} /></button>
    {children}
  </div>;
}
