'use client';
import React, { useEffect, useRef, useState, type Ref } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bell, CheckCheck, Users } from 'lucide-react';
import { useWorkspace } from '@/lib/client';
import { notificationItems, type InboxItem } from '@/lib/notifications';
import type { Task } from '@/lib/types';

export function NotificationContent({ items, onOpen }: { items: InboxItem[]; onOpen: (item: InboxItem) => void }) {
  return <><h3>Your inbox<span>{items.length}</span></h3>{items.length ? items.map((item) => <button key={`${item.kind}-${item.id}`} onClick={() => onOpen(item)}><span className="notification-icon">{item.kind === 'invitation' ? <Users size={16} /> : <CheckCheck size={16} />}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight size={13} /></button>) : <p>You’re all caught up. No pending actions.</p>}</>;
}

export function NotificationTrigger({ count, open, onClick, buttonRef }: { count: number; open: boolean; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  return <button ref={buttonRef} className="button icon-button" aria-label={`Notifications: ${count} pending actions`} aria-haspopup="dialog" aria-expanded={open} onClick={onClick}><Bell size={17} />{count > 0 && <span className="notification-dot" />}</button>;
}

export function Notifications({ onOpenTask, onOpenInvitations }: { onOpenTask: (task: Task) => void; onOpenInvitations: () => void }) {
  const { tasks, projects, team, workspaceId } = useWorkspace();
  const items = notificationItems(tasks, projects, team.invitations);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [workspaceId]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="notification-anchor" ref={anchor}>
    <NotificationTrigger count={items.length} open={open} buttonRef={trigger} onClick={() => setOpen((value) => !value)} />
    <AnimatePresence>{open && <motion.div className="notification-popover" role="dialog" aria-label="Notifications" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><NotificationContent items={items} onOpen={(item) => { setOpen(false); if (item.kind === 'invitation') onOpenInvitations(); else onOpenTask(item.task); }} /></motion.div>}</AnimatePresence>
  </div>;
}
