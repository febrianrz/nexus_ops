'use client';
import type { Actor, Priority } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Flag,
  Ban,
  AlertTriangle,
  ArrowUp,
  Bot,
  Check,
  Cpu,
  ScanLine,
  ShieldCheck,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Terminal,
  X,
} from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.span className="button-motion" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
      <button type="button" className={`button ${className}`} {...props}>
        {children}
      </button>
    </motion.span>
  );
}
export function IconButton({
  children,
  label,
  onClick,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      className={`icon-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
export const agentColors: Record<string, string> = {
  triage: 'violet',
  coder: 'lime',
  qa: 'blue',
  security: 'amber',
  admin: 'human',
};
export function Avatar({
  actor,
  size = 26,
  active = actor?.status === 'EXECUTING',
}: {
  actor?: Actor;
  size?: number;
  active?: boolean;
}) {
  const role = actor?.handle.replace('@bot-', '');
  const color = actor ? (agentColors[actor.id] ?? agentColors[role ?? ''] ?? 'pink') : 'neutral';
  const Icon =
    role === 'triage'
      ? ScanLine
      : role === 'coder'
        ? Terminal
        : role === 'qa'
          ? ShieldCheck
          : role === 'sec-scanner'
            ? ShieldCheck
            : Bot;
  return (
    <span
      className={`avatar ${color} ${actor?.type === 'HUMAN' ? 'human' : ''} ${active ? 'is-active' : ''}`}
      style={{ width: size, height: size, flexShrink: 0 }}
      title={actor?.handle}
    >
      {actor?.avatar_url ? (
        <img src={actor.avatar_url} alt="" className="avatar-image" />
      ) : actor?.type === 'HUMAN' ? (
        <span className="human-initials">
          {actor.display_name
            .split(/\s+/)
            .map((name) => name[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </span>
      ) : (
        <Icon size={size * 0.53} />
      )}{' '}
      {size > 30 && actor?.type === 'AGENT' && <span className="ai-badge">AI</span>}
      {active && <i className="avatar-status" />}
    </span>
  );
}
export function PriorityIcon({ priority }: { priority: Priority }) {
  const Icon = priority === 'NONE' ? Ban : Flag;
  return <Icon size={14} fill={priority === 'NONE' ? 'none' : 'currentColor'} className={`priority-${priority.toLowerCase()}`} />;
}
export function Modal({
  children,
  title,
  subtitle,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.current?.querySelector<HTMLElement>('input,textarea,select,button');
    first?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
          if (e.key === 'Tab') {
            const items = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,textarea,select,a[href]',
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
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </motion.section>
    </motion.div>
  );
}
export function RollingNumber({ value }: { value: number }) {
  return (
    <span className="rolling-number">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Cpu size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function CheckMark() {
  return (
    <motion.svg width="17" height="17" viewBox="0 0 20 20">
      <motion.path
        d="M4 10l4 4 8-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
      />
    </motion.svg>
  );
}
export function CopiedIcon({ copied }: { copied: boolean }) {
  return copied ? <Check size={15} /> : <ArrowUp size={15} />;
}
