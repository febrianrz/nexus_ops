'use client';
import { api, useWorkspace } from '@/lib/client';
import type { Actor, Task, TaskEvent } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  Link2,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Button, IconButton, PriorityIcon } from './ui';
import { CreateTask } from './workspace-forms';
import { TaskPlanningCell } from './task-planning';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { TaskDescription } from './task-description';
import { TaskAttachments } from './task-attachments';
import { TaskChecklist } from './task-checklist';
export default function Inspector({
  task,
  onClose,
  onApprove,
  busy,
}: {
  task: Task;
  onClose: () => void;
  onApprove: () => void;
  busy: boolean;
}) {
  const { actors, events, refresh, tasks, projects } = useWorkspace();
  const [tab, setTab] = useState('timeline');
  const [message, setMessage] = useState('');
  const [cursor, setCursor] = useState(0);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['context']);
  const [copy, setCopy] = useState(false);
  const [showSubtask, setShowSubtask] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mention = message.match(/@([\w-]*)$/);
  const suggestions = mention
    ? actors
        .filter(
          (a) => a.type === 'HUMAN' && a.handle.toLowerCase().includes(mention[1].toLowerCase()),
        )
        .slice(0, 6)
    : [];
  const statusLabel = task.state === 'TRIAGE' || task.state === 'QUEUED' ? 'Todo' : task.state === 'EXECUTING' ? 'Progress' : task.state === 'DONE' ? 'Done' : 'Testing';
  const children = tasks.filter((item) => item.parent_task_id === task.id);
  const parentTask = tasks.find((item) => item.id === task.parent_task_id);
  const canAddSubtask = !task.parent_task_id || (parentTask && !parentTask.parent_task_id);
  const project = projects.find((item) => item.id === task.project_id);
  const timeline = events
    .filter((e) => e.task_id === task.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  useEffect(() => {
    panel.current?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  function choose(a: Actor) {
    setMessage((s) => s.replace(/@[\w-]*$/, `${a.handle} `));
    setCursor(0);
    textarea.current?.focus();
  }
  async function submit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api(`/tasks/${task.id}/events`, 'POST', { message });
      setMessage('');
      await refresh();
      toast.success('Comment added');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  const toggle = (id: string) =>
    setExpanded((a) => (a.includes(id) ? a.filter((i) => i !== id) : [...a, id]));
  return (
    <motion.div
      className="drawer-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        ref={panel}
        tabIndex={-1}
        className="inspector"
        role="dialog"
        aria-modal="true"
        aria-label={`Task inspector ${task.id}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 370, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const items = panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),a,input,textarea,[tabindex="0"]',
            );
            if (!items?.length) return;
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="inspector-top">
          <span>
            <span className="subtle">Workspace</span>
            <ChevronRight size={13} />
            <span className="mono">{task.id}</span>
          </span>
          <div>
            <IconButton
              label="Copy task link"
              onClick={() => {
                navigator.clipboard.writeText(`${location.origin}/?task=${task.id}`);
                toast.success('Task link copied');
              }}
            >
              <Link2 size={16} />
            </IconButton>
            <IconButton label="Close inspector" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </header>
        <div className="inspector-scroll">
          <div className="inspector-heading">
            <span className={`state-tag state-${task.state.toLowerCase()}`}>
              <span />
              {statusLabel}
            </span>
            <h2>{task.title}</h2>
            <TaskDescription key={task.id} task={task} />
          </div>
          <div className="properties">
            <div><span>Start date</span><TaskPlanningCell task={task} field="start_date" /></div>
            <div><span>Due date</span><TaskPlanningCell task={task} field="due_date" /></div>
            <div><span>Completion</span><TaskPlanningCell task={task} field="completion" /></div>
            <div>
              <span>Status</span>
              <span className="property-value">
                <span className={`status-dot ${task.state.toLowerCase()}`} />
                {statusLabel}
              </span>
            </div>
            <div>
              <span>Project</span>
              <span className="property-value">{project?.name ?? 'Unknown project'}</span>
            </div>
            <div>
              <span>Assignee</span><span className="property-value"><AssigneePicker task={task} showLabel /></span>
            </div>
            <div>
              <span>Task type</span>
              <span className="property-value">
                {task.is_agent_task ? `External worker · ${task.agent_key}` : 'Human task'}
              </span>
            </div>
            <div>
              <span>Priority</span>
              <span className="property-value">
                <PriorityPicker task={task} showLabel />
              </span>
            </div>
            {task.parent_task_id && (
              <div>
                <span>Parent task</span>
                <span className="property-value mono">{task.parent_task_id}</span>
              </div>
            )}
            <div>
              <span>Source</span>
              <span className="property-value mono">
                {task.source_ref}
                {task.source_url && (
                  <a
                    href={task.source_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open source"
                  >
                    <ArrowUpRight size={13} />
                  </a>
                )}
              </span>
            </div>
          </div>
          <TaskAttachments key={task.id} taskId={task.id} />
          {task.parent_task_id && parentTask?.parent_task_id && <TaskChecklist key={task.id} task={task} />}
          {canAddSubtask && (
            <section className="subtask-section">
              <div>
                <strong>{task.parent_task_id ? 'Sub-subtasks' : 'Subtasks'}</strong>
                <span>{children.length}</span>
              </div>
              {children.map((child) => (
                <div className="subtask-row" key={child.id}>
                  <span className="mono">{child.id}</span>
                  <strong>{child.title}</strong>
                  <span className={`state-tag state-${child.state.toLowerCase()}`}>
                    {child.state.toLowerCase().replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
              {showSubtask ? (
                project && (
                  <CreateTask
                    project={project}
                    parentTaskId={task.id}
                    onClose={() => setShowSubtask(false)}
                    onCreated={async () => {
                      await refresh();
                      setShowSubtask(false);
                    }}
                  />
                )
              ) : (
                <Button onClick={() => setShowSubtask(true)}>
                  <Plus size={14} />
                  {task.parent_task_id ? 'Add sub-subtask' : 'Add subtask'}
                </Button>
              )}
            </section>
          )}
          {task.state === 'WAITING_HUMAN' && (
            <div className="inspector-review">
              <div>
                <Check size={20} />
                <div>
                  <strong>Ready for your review</strong>
                  <p>The external worker finished its work. Review the context, then approve.</p>
                </div>
              </div>
              <Button className="primary" disabled={busy} onClick={onApprove}>
                Approve &amp; complete
                <ArrowRight size={14} />
              </Button>
              <small>Marks this task complete. Merge any pull request in GitHub.</small>
            </div>
          )}
          <div className="inspector-tabs" role="tablist">
            {[
              { id: 'timeline', label: 'Collaboration timeline', Icon: MessageSquare },
              { id: 'machine', label: 'Machine context', Icon: Braces },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {tab === t.id && <motion.span layoutId="activeTab" className="tab-active" />}
                <t.Icon size={14} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.16 }}
            >
              {tab === 'timeline' ? (
                <div className="timeline">
                  {timeline.map((e, i) => (
                    <TimelineEvent
                      key={e.id}
                      event={e}
                      actor={actors.find((a) => a.id === e.actor_id)}
                      last={i === timeline.length - 1}
                      expanded={expanded.includes(e.id)}
                      toggle={() => toggle(e.id)}
                    />
                  ))}
                  <div className="timeline-end">
                    <span className="breathing-dot" />
                    You’re all caught up
                  </div>
                </div>
              ) : (
                <div className="machine-content">
                  <div className="machine-live">
                    <Activity size={15} />
                    <span>Execution telemetry</span>
                    <span className="mono">
                      {task.confidence_score !== null
                        ? `${Math.round(task.confidence_score * 100)}% confidence`
                        : 'Awaiting agent'}
                    </span>
                  </div>
                  <p className="machine-status">
                    {task.live_activity_text ?? 'No active execution'}
                  </p>
                  {[
                    { id: 'context', title: 'Context payload', payload: task.context_payload },
                    {
                      id: 'protocol',
                      title: 'Agent protocol',
                      payload: {
                        task_id: task.id,
                        state: task.state,
                        project_id: task.project_id,
                        parent_task_id: task.parent_task_id,
                        is_agent_task: task.is_agent_task,
                        agent_key: task.agent_key,
                        confidence_score: task.confidence_score,
                      },
                    },
                    {
                      id: 'logs',
                      title: 'Tool call logs',
                      payload: timeline
                        .filter((e) => e.event_type === 'TOOL_CALL_LOG')
                        .map((e) => ({
                          at: e.created_at,
                          ...e.structured_payload,
                          output: e.human_message,
                        })),
                    },
                  ].map((item) => (
                    <div className="json-accordion" key={item.id}>
                      <button
                        aria-expanded={expanded.includes(item.id)}
                        onClick={() => toggle(item.id)}
                      >
                        <ChevronRight
                          size={14}
                          className={expanded.includes(item.id) ? 'rotated' : ''}
                        />
                        <Braces size={14} />
                        {item.title}
                        <span className="mono">JSON</span>
                      </button>
                      <AnimatePresence>
                        {expanded.includes(item.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="json-reveal"
                          >
                            <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  <Button
                    className="copy-context"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        JSON.stringify(task.context_payload, null, 2),
                      );
                      setCopy(true);
                      setTimeout(() => setCopy(false), 1600);
                    }}
                  >
                    {copy ? <Check size={14} /> : <Copy size={14} />}{' '}
                    {copy ? 'Copied' : 'Copy machine context'}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="comment-composer">
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                className="mention-menu"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                role="listbox"
                aria-label="Mention an actor"
              >
                {suggestions.map((a, i) => (
                  <button
                    key={a.id}
                    role="option"
                    aria-selected={i === cursor % suggestions.length}
                    className={i === cursor % suggestions.length ? 'selected' : ''}
                    onClick={() => choose(a)}
                  >
                    <Avatar actor={a} />
                    <span>
                      <strong>{a.handle}</strong>
                      <small>{a.capabilities.join(' · ')}</small>
                    </span>
                    <span className="mention-type">{a.type === 'AGENT' ? 'Agent' : 'Human'}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <textarea
            ref={textarea}
            value={message}
            placeholder="Leave a comment or @mention an agent…"
            onChange={(e) => {
              setMessage(e.target.value);
              setCursor(0);
            }}
            aria-label="Comment or mention a teammate"
            onKeyDown={(e) => {
              if (suggestions.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCursor((c) => c + 1);
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCursor((c) => (c - 1 + suggestions.length) % suggestions.length);
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  choose(suggestions[cursor % suggestions.length]);
                }
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div>
            <span>
              <AtSign size={13} />
              Mention to collaborate
            </span>
            <div>
              <IconButton
                label="Send comment"
                onClick={() => submit()}
                className={sending || !message.trim() ? 'muted' : ''}
              >
                <Send size={15} />
              </IconButton>
            </div>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}
function TimelineEvent({
  event,
  actor,
  last,
  expanded,
  toggle,
}: {
  event: TaskEvent;
  actor?: Actor;
  last: boolean;
  expanded: boolean;
  toggle: () => void;
}) {
  return (
    <div className={`timeline-event ${last ? 'last' : ''}`}>
      <div className="timeline-avatar">
        <Avatar actor={actor} size={27} />
      </div>
      <div className="timeline-body">
        <div className="timeline-byline">
          <strong>{actor?.type === 'HUMAN' ? actor.display_name : actor?.handle}</strong>
          {actor?.type === 'AGENT' && <span className="tiny-agent">AGENT</span>}
          <time>
            {new Date(event.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </time>
        </div>
        <p>{event.human_message}</p>
        {event.event_type === 'DELEGATION' && (
          <span className="event-tag">
            <GitBranch size={11} />
            Delegation · Hop {String(event.structured_payload.hop_count ?? '1')}
          </span>
        )}
        {event.event_type === 'CIRCUIT_BREAKER' && (
          <span className="event-tag warning-text">
            <ShieldAlert size={12} />
            Execution paused
          </span>
        )}
        {event.event_type === 'TOOL_CALL_LOG' && (
          <>
            <button className="log-toggle" onClick={toggle}>
              <Terminal size={12} />
              View execution log
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="json-reveal"
                >
                  <pre>{JSON.stringify(event.structured_payload, null, 2)}</pre>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
