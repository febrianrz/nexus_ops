'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import type { Task } from '@/lib/types';
import { Avatar } from './ui';

export function AssigneePicker({ task, showLabel = false }: { task: Task; showLabel?: boolean }) {
  const { actors, refresh } = useWorkspace();
  const current = actors.find((actor) => actor.id === task.assignee_id);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setPosition(null); };
    const scroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) setPosition(null); };
    document.addEventListener('pointerdown', outside); window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); };
  }, [position]);
  async function choose(id: string | null) {
    if (busy) return;
    setBusy(true);
    try { await api(`/tasks/${task.id}`, 'PATCH', { action: 'set-assignee', assignee_id: id }); await refresh(); close(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <><button ref={trigger} className="assignee-trigger" title={current?.display_name ?? 'Unassigned'} aria-label={`Assign ${task.title}: ${current?.display_name ?? 'Unassigned'}`} aria-haspopup="dialog" aria-expanded={Boolean(position)} onClick={() => {
    if (position) { close(); return; }
    const bounds = trigger.current!.getBoundingClientRect(); setQuery('');
    setPosition({ left: Math.max(8, Math.min(bounds.left, window.innerWidth - 280)), top: Math.max(8, Math.min(bounds.bottom + 5, window.innerHeight - 360)) });
  }}>{current ? <Avatar actor={current} size={23} /> : <UserRoundPlus size={15} />}{showLabel && <span>{current?.display_name ?? 'Unassigned'}</span>}</button>
  {position && createPortal(<div ref={panel} className="priority-picker assignee-picker" style={position} role="dialog" aria-label="Choose assignee" aria-busy={busy} onKeyDown={(e) => {
    e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled)') ?? []); const i = items.indexOf(document.activeElement as HTMLElement); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
  }}><input ref={search} placeholder="Search people or agents…" aria-label="Search assignees" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="assignee-options"><button disabled={busy} onClick={() => void choose(null)}><UserRoundPlus size={16} /><span>Unassigned</span>{!task.assignee_id && <Check size={14} />}</button>{(['HUMAN', 'AGENT'] as const).map((type) => {
    const matches = actors.filter((a) => a.type === type && `${a.display_name} ${a.handle}`.toLowerCase().includes(query.toLowerCase()));
    return <div key={type}><div className="priority-picker-heading">{type === 'HUMAN' ? 'Members' : 'AI agents'}</div>{matches.map((actor) => <button key={actor.id} disabled={busy} onClick={() => void choose(actor.id)}><Avatar actor={actor} size={23} /><span>{actor.display_name}<small>{actor.handle}</small></span>{task.assignee_id === actor.id && <Check size={14} />}</button>)}{!matches.length && <p className="priority-picker-empty">{query ? 'No matches' : type === 'AGENT' ? 'Add agents in account settings' : 'No members'}</p>}</div>;
  })}</div></div>, document.body)}</>;
}
