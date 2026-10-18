'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { CalendarDays, Check, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import type { Task } from '@/lib/types';
import { formatPlanningDate, isOverdue, localDate, planningDate, taskCompletion } from '@/lib/task-planning';
import { Button, Modal } from './ui';

type PlanningField = 'start_date' | 'due_date' | 'completion';

export function TaskPlanningCell({ task, field }: { task: Task; field: PlanningField }) {
  const tasks = useWorkspace((state) => state.tasks);
  const [open, setOpen] = useState(false);
  const completion = field === 'completion' ? taskCompletion(task, tasks) : 0;
  const date = field === 'completion' ? '' : planningDate(task.context_payload[field]);
  const label = field === 'completion' ? 'progress' : field === 'start_date' ? 'start date' : 'due date';
  return (
    <>
      <button
        className={`planning-cell ${field === 'completion' ? 'planning-progress' : 'planning-date'} ${field === 'due_date' && isOverdue(task) ? 'is-overdue' : ''} ${completion === 100 ? 'is-complete' : ''}`}
        aria-label={`Edit ${label} for ${task.title}${date ? `: ${formatPlanningDate(date)}${field === 'due_date' && isOverdue(task) ? ', overdue' : ''}` : field === 'completion' ? `: ${completion}%` : ': not set'}`}
        title={date ? `${formatPlanningDate(date)}${isOverdue(task) && field === 'due_date' ? ' · Overdue' : ''}` : `Set ${label}`}
        onClick={() => setOpen(true)}
      >
        {field === 'completion' ? (
          <><span className="planning-progress-track" role="progressbar" aria-label={`${task.title} progress`} aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${completion / 100})` }} /></span><span>{completion}%</span>{completion === 100 && <Check size={12} />}</>
        ) : date ? <span>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span> : <CalendarDays size={15} />}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>{open && <TaskPlanningEditor task={task} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body,
      )}
    </>
  );
}

function TaskPlanningEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { tasks, refresh } = useWorkspace();
  const [start, setStart] = useState(planningDate(task.context_payload.start_date));
  const [due, setDue] = useState(planningDate(task.context_payload.due_date));
  const [completion, setCompletion] = useState(task.context_payload.completion?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hasChildren = tasks.some((item) => item.parent_task_id === task.id);
  const percent = taskCompletion(task, tasks);
  return (
    <Modal title="Schedule & progress" subtitle={`${task.id} · ${task.title}`} onClose={() => { if (!saving) onClose(); }}>
      <form className="task-form planning-form" noValidate aria-busy={saving} onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setError('');
        if (start && due && start > due) { setError('Start date must be on or before the due date.'); return; }
        const value = completion === '' ? null : Number(completion);
        if (!hasChildren && value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) { setError('Progress must be a whole number from 0 to 100.'); return; }
        setSaving(true);
        try {
          await api(`/tasks/${task.id}`, 'PATCH', { action: 'update-planning', start_date: start || null, due_date: due || null, ...(!hasChildren ? { completion: value } : {}) });
          await refresh();
          toast.success('Schedule & progress saved');
          onClose();
        } catch (failure) { setError((failure as Error).message); }
        finally { setSaving(false); }
      }}>
        <div className="form-row">
          <label>Start date<input type="date" value={start} max={due || undefined} onChange={(event) => setStart(event.target.value)} aria-describedby={error ? 'planning-error' : undefined} /></label>
          <label>Due date<input type="date" value={due} min={start || undefined} onChange={(event) => setDue(event.target.value)} aria-describedby={error ? 'planning-error' : undefined} /></label>
        </div>
        <div className="planning-shortcuts">
          <span>Due date</span>
          <Button type="button" onClick={() => setDue(localDate())}>Today</Button>
          <Button type="button" onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); setDue(localDate(tomorrow)); }}>Tomorrow</Button>
          <Button type="button" onClick={() => { setStart(''); setDue(''); }}>Clear dates</Button>
        </div>
        {hasChildren ? (
          <div className="planning-derived"><strong>{percent}% complete</strong><p>Calculated from the progress of this task’s lowest-level subtasks.</p></div>
        ) : (
          <label>Progress (%)<input type="number" min={0} max={100} step={1} value={completion} placeholder="Automatic from status" onChange={(event) => setCompletion(event.target.value)} aria-describedby="planning-progress-help" /><small id="planning-progress-help">{task.state === 'DONE' ? 'Done tasks display 100%. This value applies when reopened.' : 'Leave empty to follow status: Done is 100%; other statuses start at 0%.'}</small></label>
        )}
        {error && <p id="planning-error" className="planning-error" role="alert">{error}</p>}
        <div className="form-footer"><Button type="button" onClick={onClose} disabled={saving}>Cancel</Button><Button className="primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
    </Modal>
  );
}
