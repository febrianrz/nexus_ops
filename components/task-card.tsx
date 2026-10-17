'use client';
import type { Actor, Task } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Avatar, Button, CheckMark, PriorityIcon, RollingNumber } from './ui';
const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
export default function TaskCard({
  task,
  actors,
  eventCount,
  onOpen,
  onApprove,
  busy,
  compact = false,
}: {
  task: Task;
  actors: Actor[];
  eventCount: number;
  onOpen: () => void;
  onApprove: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const actor = actors.find((a) => a.id === task.assignee_id);
  const from = actors.find((a) => a.id === task.delegated_by_id);
  const [approving, setApproving] = useState(false);
  const liveActivity = task.live_activity_text ?? 'Awaiting agent telemetry';
  const circuit = task.hop_count >= task.max_hops;
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
      animate={{ opacity: 1, y: 0, x: circuit ? [-4, 4, -4, 4, 0] : 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`task-card ${task.state === 'EXECUTING' ? 'executing' : ''} ${circuit ? 'circuit' : ''} ${approving ? 'approving' : ''} ${compact ? 'compact' : ''}`}
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
          <span className="task-id">
            <Source size={13} />
            {task.id}
          </span>
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
        {task.state === 'WAITING_HUMAN' && !circuit && (
          <div className="review-note">
            <Check size={13} />
            <span>Ready for human review</span>
            {task.confidence_score !== null && (
              <strong>{Math.round(task.confidence_score * 100)}%</strong>
            )}
          </div>
        )}
        {circuit && (
          <div className="circuit-note">
            <ShieldAlert size={14} />
            Delegation limit reached
          </div>
        )}
        <div className="card-footer">
          <div className="actor-relay">
            <AnimatePresence mode="popLayout">
              {from && (
                <motion.span
                  key={from.id}
                  initial={{ opacity: 0, scale: 0.8, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                >
                  <Avatar actor={from} size={22} />
                </motion.span>
              )}
            </AnimatePresence>
            {from && (
              <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 12, opacity: 1 }}>
                <ArrowRight size={11} />
              </motion.span>
            )}
            <motion.span
              key={actor?.id}
              initial={{ scale: 0.5, x: -6 }}
              animate={{ scale: 1, x: 0 }}
              transition={spring}
            >
              <Avatar actor={actor} size={24} />
            </motion.span>
            {!from && (
              <span className="actor-handle">
                {actor?.handle.replace('@bot-', '') ?? 'Unassigned'}
              </span>
            )}
          </div>
          <div className="card-meta">
            <span className={`hop-badge ${circuit ? 'hop-warning' : ''}`} title="Delegation hops">
              <GitBranch size={11} />
              <RollingNumber value={task.hop_count} />
              <span>/{task.max_hops}</span>
            </span>
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
            className={circuit ? 'warning-button' : 'approve-button'}
            disabled={busy || approving}
            onClick={() => {
              setApproving(true);
              setTimeout(() => {
                onApprove();
                setApproving(false);
              }, 450);
            }}
          >
            {approving ? <CheckMark /> : circuit ? <ShieldAlert size={13} /> : <Check size={13} />}{' '}
            {circuit ? 'Review & resolve' : approving ? 'Approved' : 'Approve & merge'}
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
