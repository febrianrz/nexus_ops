'use client';
import { useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil } from 'lucide-react';
import { api, useWorkspace } from '@/lib/client';
import type { Task } from '@/lib/types';
import { Button } from './ui';

export function TaskDescription({ task }: { task: Task }) {
  const refresh = useWorkspace((state) => state.refresh);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setEditing(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return editing ? (
    <form className="task-description-editor" aria-busy={saving} onSubmit={async (event) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true);
      setError('');
      try {
        await api(`/tasks/${task.id}`, 'PATCH', { action: 'update-description', description: draft });
        await refresh();
        close();
      } catch (failure) { setError((failure as Error).message); }
      finally { setSaving(false); }
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!saving) close(); }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); }
    }}>
      <label htmlFor={`description-${task.id}`}>Description</label>
      <textarea id={`description-${task.id}`} autoFocus rows={5} maxLength={10000} value={draft} placeholder="Describe this work, acceptance criteria, or useful context…" onChange={(event) => setDraft(event.target.value)} aria-describedby={error ? `description-error-${task.id}` : undefined} />
      {error && <span id={`description-error-${task.id}`} className="description-error" role="alert">{error}</span>}
      <div className="task-description-actions"><small>{draft.length.toLocaleString()} / 10,000</small><Button type="button" disabled={saving} onClick={close}>Cancel</Button><Button className="primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{saving ? 'Saving…' : 'Save'}</Button></div>
    </form>
  ) : (
    <button ref={trigger} className={`task-description ${task.description ? '' : 'is-empty'}`} aria-label={`${task.description ? 'Edit' : 'Add'} description for ${task.title}`} onClick={() => { setDraft(task.description); setError(''); setEditing(true); }}>
      <span>{task.description || 'Add description…'}</span><Pencil size={13} />
    </button>
  );
}
