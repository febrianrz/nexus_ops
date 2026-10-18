'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, LoaderCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, useWorkspace } from '@/lib/client';
import { Button, Modal } from './ui';

type DeveloperKey = { id: string; name: string; prefix: string; created_at: string; expires_at: string; last_used_at: string | null; revoked_at: string | null };
export default function DeveloperSettings({ onClose }: { onClose: () => void }) {
  const { team } = useWorkspace();
  const [keys, setKeys] = useState<DeveloperKey[]>([]);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState(90);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const admin = team.current?.role === 'admin';
  useEffect(() => {
    let active = true;
    if (!admin) { setLoading(false); return; }
    api<{ keys: DeveloperKey[] }>('/developer/keys').then((data) => { if (active) setKeys(data.keys); }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [team.current?.id, admin]);
  return <Modal title="Developer" subtitle={`API keys · ${team.current?.name ?? 'Workspace'}`} onClose={onClose}>
    <div className="developer-settings" aria-busy={busy || loading}>
      <p className="subtle">Connect external workers to claim agent tasks and report progress in this workspace.</p>
      {!admin ? <p className="subtle">Only workspace admins can manage API keys.</p> : <>
        {token && <section className="developer-new-key" aria-label="New API key"><strong>Copy your API key</strong><p>This key is shown once. Store it in your external application.</p><code>{token}</code><Button onClick={async () => { try { await navigator.clipboard.writeText(token); setCopied(true); } catch { setError('Could not copy. Select and copy the key above.'); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy key'}</Button><Button onClick={() => setToken('')}>I’ve saved it</Button></section>}
        <form className="developer-create" onSubmit={async (event) => {
          event.preventDefault(); if (busy || token) return;
          setBusy(true); setError('');
          try {
            const data = await api<{ key: DeveloperKey; token: string }>('/developer/keys', 'POST', { action: 'create', name, expires_in_days: expiry });
            setKeys((current) => [data.key, ...current]); setToken(data.token); setCopied(false); setName('');
          } catch (failure) { setError((failure as Error).message); }
          finally { setBusy(false); }
        }}>
          <label>Key name<input required minLength={2} maxLength={80} placeholder="e.g. Backend worker" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Expires in<select value={expiry} onChange={(event) => setExpiry(Number(event.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option></select></label>
          <Button className="primary" type="submit" disabled={busy || Boolean(token)}>{busy ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}Create API key</Button>
        </form>
        {loading ? <p role="status" className="subtle">Loading API keys…</p> : <ul className="developer-key-list">{keys.map((key) => {
          const expired = new Date(key.expires_at).getTime() <= Date.now();
          return <li key={key.id}><KeyRound size={16} /><div><strong>{key.name}</strong><code>{key.prefix}…</code><small>{key.revoked_at ? 'Revoked' : expired ? 'Expired' : `Expires ${new Date(key.expires_at).toLocaleDateString()}`}{key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' · Never used'}</small></div>{!key.revoked_at && (revoking === key.id ? <div className="developer-revoke-actions"><Button disabled={busy} onClick={async () => {
            if (busy) return; setBusy(true); setError('');
            try { await api('/developer/keys', 'POST', { action: 'revoke', key_id: key.id }); setKeys((current) => current.map((item) => item.id === key.id ? { ...item, revoked_at: new Date().toISOString() } : item)); setToken(''); toast.success('API key revoked'); setRevoking(null); }
            catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
          }}>Confirm revoke</Button><Button disabled={busy} onClick={() => setRevoking(null)}>Cancel</Button></div> : <Button disabled={busy} onClick={() => setRevoking(key.id)}>Revoke</Button>)}</li>;
        })}</ul>}
        {!loading && !keys.length && <p className="subtle">No API keys yet. Create one to connect an external worker.</p>}
        <p className="developer-key-help">Use <code>Authorization: Bearer YOUR_API_KEY</code> with the REST API. <a href="/developer/docs" target="_blank" rel="noreferrer">Open API docs</a>. Keys cannot manage members or access another workspace.</p>
      </>}
      {error && <p className="developer-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}
