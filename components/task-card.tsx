'use client';
import type { Task } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  CircleDot,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  MoreHorizontal,
  ListTree,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Button, CheckMark, PriorityIcon } from './ui';
const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
export default function TaskCard({
  task,
  eventCount,
  onOpen,
  onApprove,
  busy,
  compact = false,
}: {
  task: Task;
  eventCount: number;
  onOpen: () => void;
  onApprove: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const [approving, setApproving] = useState(false);
  const liveActivity = task.live_activity_text ?? 'Awaiting agent telemetry';
  const Source =
    task.source_type === 'GITHUB_PR'
      ? GitPullRequest
      : task.source_type === 'TICKET'
        ? Ticket
        : CircleDot;
  return (
    <motion.article
      layout
      layoutId={task.id}
      transition={{ default: spring, layout: spring, x: { type: 'tween', duration: 0.38 } }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`task-card ${task.state === 'EXECUTING' ? 'executing' : ''} ${approving ? 'approving' : ''} ${compact ? 'compact' : ''}`}
    >
      <div
        className="card-main"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen();
        }}
        aria-label={`Open ${task.id}: ${task.title}`}
      >
        <div className="card-top">
          <span className="card-top-right">
            <PriorityIcon priority={task.priority} />
            <MoreHorizontal size={16} />
          </span>
        </div>
        <h3>{task.title}</h3>
        {!compact && (
          <div className="task-labels">
            {task.labels.map((l) => (
              <span key={l} className={`task-label label-${l}`}>
                {l}
              </span>
            ))}
          </div>
        )}
        {task.context_payload.branch && task.state === 'EXECUTING' && (
          <div className="branch">
            <GitBranch size={12} />
            <span>{task.context_payload.branch}</span>
          </div>
        )}
        {task.state === 'WAITING_HUMAN' && (
          <div className="review-note">
            <Check size={13} />
            <span>Ready for human review</span>
            {task.confidence_score !== null && (
              <strong>{Math.round(task.confidence_score * 100)}%</strong>
            )}
          </div>
        )}
        <div className="card-footer">
          <span className="task-worker-label">
            {task.parent_task_id && <ListTree size={12} />}
            {task.is_agent_task
              ? `External worker · ${task.agent_key}`
              : task.parent_task_id
                ? 'Subtask'
                : 'Human task'}
          </span>
          <div className="card-meta">
            <span className="comment-count">
              <MessageSquare size={12} />
              {eventCount}
            </span>
          </div>
        </div>
      </div>
      {task.state === 'EXECUTING' && (
        <div className="live-ticker">
          <Zap size={12} />
          <div>
            <AnimatePresence mode="wait">
              <motion.span
                key={liveActivity}
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -9 }}
                transition={{ duration: 0.25 }}
              >
                {liveActivity}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="ticker-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      {task.state === 'WAITING_HUMAN' && (
        <div className="approval-area">
          <Button
            className="approve-button"
            disabled={busy || approving}
            onClick={() => {
              setApproving(true);
              setTimeout(() => {
                onApprove();
                setApproving(false);
              }, 450);
            }}
          >
            {approving ? <CheckMark /> : <Check size={13} />}{' '}
            {approving ? 'Approved' : 'Approve & complete'}
            <ArrowUpRight size={12} />
          </Button>
        </div>
      )}
      {task.state === 'DONE' && (
        <div className="completed-note">
          <Check size={12} />
          Completed by human review
          <Sparkles size={12} />
        </div>
      )}
    </motion.article>
  );
}
