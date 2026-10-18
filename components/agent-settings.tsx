'use client';
import { useState } from 'react';
import { Bot, ImagePlus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import { Button, Modal } from './ui';
export default function AgentSettings({ onClose }: { onClose: () => void }) {
  const { actors, team, refresh } = useWorkspace();
  const admin = team.current?.role === 'admin';
  const agents = actors.filter((a) => a.type === 'AGENT');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reset = () => { setEditing(null); setName(''); setUsername(''); setAvatarUrl(null); setError(''); };
  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setError('Avatar harus PNG, JPEG, WebP, atau GIF.'); return; }
    if (file.size > 1024 * 1024) { setError('Ukuran avatar maksimal 1 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => setAvatarUrl(String(reader.result)); reader.readAsDataURL(file);
  }
  async function remove(id: string) {
    if (busy) return; setBusy(true); setError('');
    try { await api('/agents', 'POST', { action: 'delete', id }); await refresh(); setRemoving(null); if (editing === id) reset(); toast.success('Agent removed'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="AI agents" subtitle={team.current?.name ?? 'Workspace'} onClose={onClose}><div className="developer-settings" aria-busy={busy}><p className="subtle">Assign tasks to agent identities. Your third-party application runs the AI and fetches tasks using the agent’s username.</p>{admin ? <form className="developer-create agent-create" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api('/agents', 'POST', { action: editing ? 'update' : 'create', ...(editing ? { id: editing } : {}), name, username, avatar_url: avatarUrl }); await refresh(); reset(); toast.success(editing ? 'Agent updated' : 'Agent added'); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }}><div className="agent-avatar-field"><span className="agent-avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="" /> : <Bot size={24} />}</span><div><strong>Avatar</strong><small>PNG, JPEG, WebP, or GIF · max 1 MB</small><label className="button primary agent-avatar-upload"><ImagePlus size={14} />{avatarUrl ? 'Change avatar' : 'Add avatar'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => chooseAvatar(e.target.files?.[0])} /></label></div>{avatarUrl && <button type="button" className="agent-avatar-clear" aria-label="Remove avatar" onClick={() => setAvatarUrl(null)}><X size={15} /></button>}</div><label>Display name<input required minLength={2} maxLength={80} value={name} placeholder="Backend agent" onChange={(e) => setName(e.target.value)} /></label><label>Username<input required pattern="[a-z][a-z0-9_-]{0,39}" maxLength={40} value={username} placeholder="backend" onChange={(e) => setUsername(e.target.value.toLowerCase())} /><small>Unique in this workspace · letters, numbers, _ or -</small></label><Button type="submit" className="primary" disabled={busy}><Plus size={14} />{editing ? 'Save changes' : 'Add agent'}</Button>{editing && <Button disabled={busy} onClick={reset}>Cancel edit</Button>}</form> : <p className="subtle">Only workspace admins can manage agents.</p>}<ul className="developer-key-list">{agents.map((agent) => <li key={agent.id}><span className="agent-list-avatar">{agent.avatar_url ? <img src={agent.avatar_url} alt="" /> : <Bot size={18} />}</span><div><strong>{agent.display_name}</strong><code>{agent.handle}</code></div>{admin && (removing === agent.id ? <div className="agent-remove"><small>Clear assignments? Tasks will be kept.</small><Button disabled={busy} onClick={() => void remove(agent.id)}>Remove</Button><Button disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button></div> : <><Button disabled={busy} onClick={() => { setEditing(agent.id); setName(agent.display_name); setUsername(agent.handle.replace(/^@/, '')); setAvatarUrl(agent.avatar_url); setError(''); }}>Edit</Button><Button disabled={busy} onClick={() => setRemoving(agent.id)}>Remove</Button></>)}</li>)}</ul>{!agents.length && <p className="subtle">No agents yet. Add an identity, then assign it to any task or subtask.</p>}{error && <p role="alert" className="developer-error">{error}</p>}<p className="developer-key-help">External workers use Developer API keys and <code>agent_key=USERNAME</code>. Renaming a username updates assigned tasks and resets active worker claims.</p></div></Modal>;
}
