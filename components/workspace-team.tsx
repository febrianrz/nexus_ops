'use client';
import { api, useWorkspace } from '@/lib/client';
import type { SessionUser } from '@/lib/auth-types';
import type { WorkspaceRole } from '@/lib/team-types';
import { Check, LoaderCircle, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal } from './ui';

export function WorkspacePicker({
  onClose,
  onSwitch,
}: {
  onClose: () => void;
  onSwitch: (id: string) => Promise<void>;
}) {
  const { team } = useWorkspace();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  async function run(fn: () => Promise<void>, status = 'Switching workspace…') {
    setBusy(true);
    setError('');
    setProgress(status);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Your workspaces"
      subtitle="Switch teams, accept an invitation, or start a new workspace."
      onClose={onClose}
    >
      <div className="team-content" aria-busy={busy}>
        {busy && (
          <p className="subtle" role="status">
            {progress}
          </p>
        )}
        {error && (
          <p className="team-error" role="alert">
            {error}
          </p>
        )}
        <div className="workspace-options">
          {team.workspaces.map((workspace) => (
            <button
              disabled={busy}
              key={workspace.id}
              className="workspace-option"
              aria-current={workspace.id === team.current?.id ? 'true' : undefined}
              onClick={() => {
                if (!busy) void run(() => onSwitch(workspace.id));
              }}
            >
              <Users size={18} />
              <span>
                <strong>{workspace.name}</strong>
                <small>{workspace.role === 'admin' ? 'Admin' : 'Member'}</small>
              </span>
              {workspace.id === team.current?.id && <Check size={17} />}
            </button>
          ))}
        </div>
        {team.invitations.length > 0 && (
          <section className="team-section">
            <h3>
              Invitations <span className="subtle">{team.invitations.length}</span>
            </h3>
            <p className="subtle">Accept to share projects and tasks with this team.</p>
            {team.invitations.map((invitation) => (
              <div className="member-row" key={invitation.id}>
                <span>
                  <strong>{invitation.workspace_name}</strong>
                  <small>
                    Invited as {invitation.role} · expires{' '}
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </small>
                </span>
                <div className="team-actions">
                  <Button
                    disabled={busy}
                    onClick={() => {
                      if (!busy)
                        void run(async () => {
                          await api('/workspaces', 'POST', {
                            action: 'respond',
                            invitation_id: invitation.id,
                            accept: false,
                          });
                          await useWorkspace.getState().refresh();
                        }, 'Declining invitation…');
                    }}
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={busy}
                    className="primary"
                    onClick={() => {
                      if (!busy)
                        void run(async () => {
                          const result = await api<{ workspace_id: string }>(
                            '/workspaces',
                            'POST',
                            { action: 'respond', invitation_id: invitation.id, accept: true },
                          );
                          toast.success('Invitation accepted');
                          await onSwitch(result.workspace_id);
                        }, 'Accepting invitation…');
                    }}
                  >
                    Accept invitation
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}
        <form
          className="task-form team-create"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy)
              void run(async () => {
                const result = await api<{ workspace: { id: string } }>('/workspaces', 'POST', {
                  action: 'create',
                  name,
                });
                await onSwitch(result.workspace.id);
                toast.success('Workspace created');
              }, 'Creating workspace…');
          }}
        >
          <label>
            New workspace name
            <input
              disabled={busy}
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Platform engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit" className="primary">
            {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Create
            workspace
          </Button>
        </form>
      </div>
    </Modal>
  );
}
export function WorkspaceTeam({ user }: { user: SessionUser }) {
  const { team, refresh } = useWorkspace();
  const admin = team.current?.role === 'admin';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  async function manage(body: Record<string, unknown>, success: string) {
    if (busy || !team.current) return;
    setBusy(true);
    setError('');
    setProgress(
      body.action === 'invite'
        ? 'Creating invitation…'
        : body.action === 'role'
          ? 'Updating member role…'
          : body.action === 'remove'
            ? 'Removing member…'
            : 'Revoking invitation…',
    );
    try {
      await api('/workspaces', 'POST', { ...body, workspace_id: team.current.id });
      await refresh();
      toast.success(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="team-content team-settings" aria-busy={busy}>
      {busy && (
        <p className="subtle" role="status">
          {progress}
        </p>
      )}
      <div className="team-section">
        <h3>
          Members <span className="subtle">{team.members.length}</span>
        </h3>
        <p className="subtle">
          Admins manage membership. Members can create projects, tasks, and subtasks, then review
          work.
        </p>
        {error && (
          <p className="team-error" role="alert">
            {error}
          </p>
        )}
        {team.members.map((member) => (
          <div className="member-row" key={member.user_id}>
            <span>
              <strong>
                {member.name}
                {member.user_id === user.id ? ' (you)' : ''}
              </strong>
              <small>{member.email}</small>
            </span>
            {admin ? (
              <div className="team-actions">
                <select
                  disabled={busy}
                  aria-label={`Role for ${member.email}`}
                  value={member.role}
                  onChange={(e) => {
                    void manage(
                      { action: 'role', user_id: member.user_id, role: e.target.value },
                      'Member role updated',
                    );
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                {removing === member.user_id ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void manage(
                          { action: 'remove', user_id: member.user_id },
                          'Member removed',
                        ).then((ok) => {
                          if (ok) setRemoving(null);
                        });
                      }}
                    >
                      Confirm remove
                    </Button>
                    <Button disabled={busy} onClick={() => setRemoving(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button disabled={busy} onClick={() => setRemoving(member.user_id)}>
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <span className="role-label">{member.role}</span>
            )}
          </div>
        ))}
      </div>
      {admin ? (
        <>
          <form
            className="task-form team-section"
            onSubmit={(e) => {
              e.preventDefault();
              void manage(
                { action: 'invite', email, role },
                'Invitation created. It will appear when this user signs in.',
              ).then((ok) => {
                if (ok) setEmail('');
              });
            }}
          >
            <h3>Invite a teammate</h3>
            <p className="subtle">
              Invitations appear in the app and expire after 7 days. Your teammate must already have
              a registered account.
            </p>
            <div className="team-invite-fields">
              <label>
                Email address
                <input
                  disabled={busy}
                  type="email"
                  required
                  maxLength={254}
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Role
                <select
                  disabled={busy}
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <Button disabled={busy} type="submit" className="primary">
              {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Create
              invitation
            </Button>
          </form>
          {team.pending.length > 0 && (
            <section className="team-section">
              <h3>Pending invitations</h3>
              {team.pending.map((invitation) => (
                <div className="member-row" key={invitation.id}>
                  <span>
                    <strong>{invitation.email}</strong>
                    <small>
                      {invitation.role} · expires{' '}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </small>
                  </span>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void manage(
                        { action: 'revoke', invitation_id: invitation.id },
                        'Invitation revoked',
                      );
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <p className="subtle">Ask a workspace admin to invite teammates or change roles.</p>
      )}
    </section>
  );
}
