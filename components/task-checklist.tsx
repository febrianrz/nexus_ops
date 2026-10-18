'use client';
import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import type { Task } from '@/lib/types';
import { Button } from './ui';

type Item = { id: string; text: string; completed: boolean };
export function TaskChecklist({ task }: { task: Task }) {
  const refresh = useWorkspace((state) => state.refresh);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const items = Array.isArray(task.context_payload.checklist) ? task.context_payload.checklist : [];
  const save = async (next: Item[]) => {
    if (busy) return;
    setBusy(true);
    try { await api(`/tasks/${task.id}`, 'PATCH', { action: 'update-checklist', checklist: next }); await refresh(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };
  const add = async () => { const text = draft.trim(); if (!text || items.length >= 50) return; setDraft(''); await save([...items, { id: crypto.randomUUID(), text, completed: false }]); };
  return <section className="task-checklist" aria-labelledby={`checklist-${task.id}`}>
    <div className="task-checklist-heading"><strong id={`checklist-${task.id}`}>Checklist</strong><span>{items.filter((item) => item.completed).length}/{items.length}</span></div>
    <div className="task-checklist-items">{items.map((item) => <div className={`task-checklist-item ${item.completed ? 'is-complete' : ''}`} key={item.id}><button type="button" disabled={busy} aria-label={`${item.completed ? 'Uncomplete' : 'Complete'} ${item.text}`} onClick={() => void save(items.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry))}><span>{item.completed && <Check size={12} />}</span></button><input defaultValue={item.text} disabled={busy} aria-label="Checklist item" onBlur={(event) => { const value = event.currentTarget.value.trim(); if (value && value !== item.text) void save(items.map((entry) => entry.id === item.id ? { ...entry, text: value } : entry)); }} /><button type="button" disabled={busy} aria-label={`Remove ${item.text}`} onClick={() => void save(items.filter((entry) => entry.id !== item.id))}><Trash2 size={14} /></button></div>)}</div>
    <div className="task-checklist-add"><input value={draft} maxLength={240} placeholder="Add checklist item…" aria-label="New checklist item" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} /><Button type="button" disabled={busy || !draft.trim()} onClick={() => void add()}><Plus size={14} />Add item</Button></div>
    <small>Progress is calculated from completed checklist items.</small>
  </section>;
}
