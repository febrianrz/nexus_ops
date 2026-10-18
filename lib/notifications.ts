import type { Project, Task } from './types';
import type { TeamData } from './team-types';

export type InboxItem =
  | { kind: 'invitation'; id: string; title: string; detail: string; workspaceId: string }
  | { kind: 'task'; id: string; title: string; detail: string; task: Task };

export function notificationItems(tasks: Task[], projects: Project[], invitations: TeamData['invitations'], now = Date.now()): InboxItem[] {
  const names = new Map(projects.map((project) => [project.id, project.name]));
  return [
    ...invitations.filter((invitation) => new Date(invitation.expires_at).getTime() > now).map((invitation): InboxItem => ({ kind: 'invitation', id: invitation.id, title: `Invitation to ${invitation.workspace_name}`, detail: `Join as ${invitation.role}`, workspaceId: invitation.workspace_id })),
    ...tasks.filter((task) => task.project_id && names.has(task.project_id) && ['WAITING_HUMAN', 'BLOCKED'].includes(task.state)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((task): InboxItem => ({ kind: 'task', id: task.id, title: task.title, detail: `${names.get(task.project_id!)} · ${task.state === 'BLOCKED' ? 'Needs attention' : 'Ready for testing'}`, task })),
  ];
}
