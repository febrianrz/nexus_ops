'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import type { Priority, Task } from '@/lib/types';
import { priorityLabel, priorityOptions } from '@/lib/task-priority';
import { PriorityIcon } from './ui';

export function PriorityPicker({ task, showLabel = false }: { task: Task; showLabel?: boolean }) {
  const refresh = useWorkspace((state) => state.refresh);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const options = priorityOptions.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) setPosition(null); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); };
  }, [position]);
  async function choose(priority: Priority) {
    if (saving) return;
    if (priority === task.priority) { close(); return; }
    setSaving(true);
    try {
      await api(`/tasks/${task.id}`, 'PATCH', { action: 'set-priority', priority });
      await refresh();
      close();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }
  return <>
    <button ref={trigger} className="priority-trigger" aria-label={`Change priority for ${task.title}: ${priorityLabel(task.priority)}`} aria-haspopup="dialog" aria-expanded={Boolean(position)} onClick={() => {
      if (position) { close(); return; }
      const bounds = trigger.current!.getBoundingClientRect();
      setQuery('');
      setPosition({ left: Math.max(8, Math.min(bounds.left, window.innerWidth - 228)), top: Math.max(8, Math.min(bounds.bottom + 5, window.innerHeight - 312)) });
    }}><PriorityIcon priority={task.priority} />{showLabel && <span>{priorityLabel(task.priority)}</span>}</button>
    {position && createPortal(<div ref={panel} className="priority-picker" role="dialog" aria-label={`Priority for ${task.title}`} aria-busy={saving} style={position} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if ((event.metaKey || event.ctrlKey) && priorityOptions.some((item) => item.shortcut === event.key)) { event.preventDefault(); void choose(priorityOptions.find((item) => item.shortcut === event.key)!.value); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled)') ?? []);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        controls[(index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus();
      }
    }}>
      <input ref={search} aria-label="Search priority" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="priority-picker-heading">Priority{saving && <LoaderCircle size={13} className="spin" />}</div>
      <div role="menu" aria-label="Priority options">{options.map((option) => <button type="button" role="menuitemradio" aria-checked={task.priority === option.value} key={option.value} disabled={saving} onClick={() => void choose(option.value)}><PriorityIcon priority={option.value} /><span>{option.label}</span>{task.priority === option.value && <Check size={12} />}<kbd>⌘{option.shortcut}</kbd></button>)}</div>
      {!options.length && <p className="priority-picker-empty">No matching priorities</p>}
    </div>, document.body)}
  </>;
}
