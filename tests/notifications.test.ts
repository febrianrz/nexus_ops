import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationTrigger, NotificationContent } from '../components/notifications';
import { notificationItems } from '../lib/notifications';
import { seedWorkspace } from '../lib/seed';
import { useWorkspace } from '../lib/client';
import type { TeamData } from '../lib/team-types';

const now = Date.parse('2026-10-18T00:00:00Z');
const invitation = { id: 'invite', workspace_id: 'shared', workspace_name: 'Shared workspace', role: 'member' as const, expires_at: '2026-10-20T00:00:00Z' };
const noop = () => undefined;
test('inbox combines unexpired invitations with actionable tasks across every authorized project', () => {
  const workspace = seedWorkspace();
  const tasks = [
    { ...workspace.tasks[0], id: 'testing', state: 'WAITING_HUMAN' as const },
    { ...workspace.tasks[0], id: 'blocked', project_id: 'second', state: 'BLOCKED' as const },
    { ...workspace.tasks[0], id: 'done', state: 'DONE' as const },
    { ...workspace.tasks[0], id: 'foreign', project_id: 'foreign', state: 'WAITING_HUMAN' as const },
  ];
  const items = notificationItems(tasks, [...workspace.projects, { ...workspace.projects[0], id: 'second', name: 'Second project' }], [invitation, { ...invitation, id: 'expired', expires_at: '2026-10-17T00:00:00Z' }], now);
  assert.equal(items.length, 3);
  assert.equal(items[0].kind, 'invitation');
  assert.deepEqual(items.filter((item) => item.kind === 'task').map((item) => item.id).sort(), ['blocked', 'testing']);
  assert.ok(items.some((item) => item.detail.includes('Second project')));
  assert.equal(notificationItems([], [], [], now).length, 0);
});
test('resolving invitations and testing tasks removes their notifications without synthetic unread state', () => {
  const workspace = seedWorkspace();
  const pending = { ...workspace.tasks[0], state: 'WAITING_HUMAN' as const };
  assert.equal(notificationItems([pending], workspace.projects, [invitation], now).length, 2);
  assert.equal(notificationItems([{ ...pending, state: 'DONE' }], workspace.projects, [], now).length, 0);
});
test('empty notification button has no attention indicator and populated button exposes the correct count', () => {
  const workspace = seedWorkspace();
  const empty = renderToStaticMarkup(createElement(NotificationTrigger, { count: 0, open: false, onClick: noop }));
  assert.ok(empty.includes('Notifications: 0 pending actions'));
  assert.ok(!empty.includes('notification-dot'));
  const activeInvite = { ...invitation, expires_at: new Date(Date.now() + 86400000).toISOString() };
  const items = notificationItems([{ ...workspace.tasks[0], state: 'WAITING_HUMAN' }], workspace.projects, [activeInvite]);
  const filled = renderToStaticMarkup(createElement(NotificationTrigger, { count: items.length, open: false, onClick: noop }));
  assert.ok(filled.includes('Notifications: 2 pending actions'));
  assert.ok(filled.includes('notification-dot'));
  assert.ok(filled.includes('aria-expanded="false"'));
});
test('notification content renders invitations, project context, and the empty state', () => {
  const workspace = seedWorkspace();
  const items = notificationItems([{ ...workspace.tasks[0], state: 'WAITING_HUMAN' }], workspace.projects, [invitation], now);
  const content = renderToStaticMarkup(createElement(NotificationContent, { items, onOpen: noop }));
  assert.ok(content.includes('Invitation to Shared workspace'));
  assert.ok(content.includes('Ready for testing'));
  const empty = renderToStaticMarkup(createElement(NotificationContent, { items: [], onOpen: noop }));
  assert.ok(empty.includes('No pending actions'));
});
