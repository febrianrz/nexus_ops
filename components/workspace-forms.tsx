'use client';
import { api } from '@/lib/client';
import type { Actor } from '@/lib/types';
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Button, IconButton, Modal } from './ui';

export function CreateTask({
  onClose,
  onCreated,
  triageActor,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  triageActor?: Actor;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState('MANUAL');
  return (
    <Modal
      title="Make the next move."
      subtitle="Add the context. Your team will take it from here."
      onClose={onClose}
    >
      <form
        className="task-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await api('/ingest', 'POST', {
              title,
              description,
              priority,
              source_type: source,
              source_ref: `manual-${Date.now()}`,
              labels: [],
            });
            await onCreated();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          Task title
          <input
            autoFocus
            required
            minLength={3}
            maxLength={180}
            placeholder="What needs to happen?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            placeholder="Goals, acceptance criteria, useful context…"
            value={description}
            maxLength={10000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="MANUAL">Manual</option>
              <option value="TICKET">Support ticket</option>
              <option value="GITHUB_ISSUE">GitHub issue</option>
              <option value="GITHUB_PR">GitHub pull request</option>
            </select>
          </label>
        </div>
        <div className="form-info">
          {triageActor ? (
            <>
              <Avatar actor={triageActor} size={23} />
              <span>
                <strong>{triageActor.handle}</strong> will pick this up automatically.
              </span>
            </>
          ) : (
            <>
              <Plus size={15} />
              <span>
                This task will start in triage. Register an agent when you’re ready to delegate.
              </span>
            </>
          )}
        </div>
        <div className="form-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="primary" disabled={saving}>
            {saving ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function SpawnAgent({
  actors,
  onClose,
  refresh,
}: {
  actors: Actor[];
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [parent, setParent] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = `curl -X POST "$NEXUS_URL/api/v1/actors/agents" \\\n  -H "Authorization: Bearer $NEXUS_ADMIN_TOKEN" \\\n  -H "X-Nexus-Workspace: $NEXUS_WORKSPACE_ID" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
    {
      handle: `@${handle || 'bot-your-agent'}`,
      display_name: name || 'Your agent',
      capabilities: capabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      ...(parent ? { parent_agent_id: parent } : {}),
    },
  ).replaceAll("'", "'\\''")}'`;
  return (
    <Modal
      title={token ? 'Meet your newest teammate.' : 'A new capability. A new teammate.'}
      subtitle={
        token
          ? 'Your agent is registered and ready to receive work.'
          : 'Register an agent identity with a scoped API token.'
      }
      onClose={onClose}
    >
      {token ? (
        <div className="token-success">
          <span className="success-orb">
            <Check size={27} />
          </span>
          <h3>@{handle} is online.</h3>
          <p>Copy this token now. It’s shown once and stored as a hash.</p>
          <div className="token-value">
            <code>{token}</code>
            <IconButton
              label="Copy API token"
              onClick={() => {
                navigator.clipboard.writeText(token);
                toast.success('Agent token copied');
              }}
            >
              <Copy size={16} />
            </IconButton>
          </div>
          <Button className="primary" onClick={onClose}>
            Back to the workspace
            <ArrowRight size={15} />
          </Button>
        </div>
      ) : (
        <form
          className="task-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const data = await api<{ actor: Actor; token: string }>('/actors/agents', 'POST', {
                handle: `@${handle}`,
                display_name: name,
                capabilities: capabilities
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean),
                parent_agent_id: parent || null,
              });
              setToken(data.token);
              await refresh();
              toast.success('New agent registered');
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-row">
            <label>
              Display name
              <input
                autoFocus
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Code reviewer"
              />
            </label>
            <label>
              Unique handle
              <div className="handle-input">
                <span>@</span>
                <input
                  required
                  pattern="[a-z][a-z0-9-]{2,40}"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="bot-reviewer"
                />
              </div>
            </label>
          </div>
          <label>
            Capabilities<span className="field-hint">Separate with commas</span>
            <input
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="code review, typescript, security"
            />
          </label>
          <label>
            Parent agent
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Core agent · no parent</option>
              {actors
                .filter((a) => a.type === 'AGENT')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle}
                  </option>
                ))}
            </select>
          </label>
          <div className="api-snippet">
            <header>
              <Terminal size={13} />
              <span>Or register via API</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </header>
            <pre>{snippet}</pre>
          </div>
          <div className="form-footer">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="primary" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={15} /> : <Bot size={15} />}Spawn agent
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export function IntegrationSetup({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const snippet = `curl -X POST "$NEXUS_URL/api/v1/ingest" \\\n  -H "Authorization: Bearer $NEXUS_ADMIN_TOKEN" \\\n  -H "X-Nexus-Workspace: $NEXUS_WORKSPACE_ID" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Investigate a customer report","source_type":"TICKET","source_ref":"SUP-285"}'`;
  return (
    <Modal
      title="Connect the dots."
      subtitle="Use signed GitHub webhooks or the universal ingest API."
      onClose={onClose}
      wide
    >
      <div className="integration-setup">
        <h3>GitHub webhook</h3>
        <p>
          In your repository’s webhook settings, add the payload URL below. Choose{' '}
          <code>application/json</code>, subscribe to <strong>Issues</strong> and{' '}
          <strong>Pull requests</strong>, and set the secret to your server’s{' '}
          <code>NEXUS_WEBHOOK_SECRET</code>.
        </p>
        <code className="endpoint">POST /api/v1/ingest</code>
        <h3>Tickets and custom sources</h3>
        <p>
          Send a structured task with your administrator token. Repeated source references are
          deduplicated automatically.
        </p>
        <div className="api-snippet">
          <header>
            <Terminal size={13} />
            <span>Universal ingest</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                setCopied(true);
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </header>
          <pre>{snippet}</pre>
        </div>
        <div className="form-info">
          <ShieldCheck size={17} />
          <span>
            External requests require authentication. Configure credentials in your server
            environment.
          </span>
        </div>
      </div>
    </Modal>
  );
}
