export type WorkspaceRole = 'admin' | 'member';
export interface WorkspaceEntry {
  id: string;
  name: string;
  role: WorkspaceRole;
}
export interface TeamData {
  workspaces: WorkspaceEntry[];
  current: WorkspaceEntry | null;
  members: { user_id: string; name: string; email: string; role: WorkspaceRole }[];
  pending: { id: string; email: string; role: WorkspaceRole; expires_at: string }[];
  invitations: {
    id: string;
    workspace_id: string;
    workspace_name: string;
    role: WorkspaceRole;
    expires_at: string;
  }[];
}
