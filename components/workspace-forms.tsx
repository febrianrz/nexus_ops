'use client';
import { api } from '@/lib/client';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  LoaderCircle,
  Plus,
  ShieldCheck,
  SquareTerminal,
  Terminal,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import { Button, Modal } from './ui';

export function CreateTask({
  project,
  parentTaskId,
  onClose,
  onCreated,
}: {
  project: Project;
  parentTaskId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [completion, setCompletion] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [source, setSource] = useState('MANUAL');
  const [isAgentTask, setIsAgentTask] = useState(false);
  const [agentKey, setAgentKey] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title={parentTaskId ? 'Add a subtask.' : 'Create a task.'}
      subtitle={`This work belongs to ${project.name}.`}
      onClose={onClose}
    >
      <form
        className="task-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await api('/ingest', 'POST', {
              title,
              description,
              priority,
              source_type: source,
              source_ref: `manual-${Date.now()}`,
              project_id: project.id,
              parent_task_id: parentTaskId ?? null,
              is_agent_task: isAgentTask,
              agent_key: isAgentTask ? agentKey.trim().toLowerCase() : null,
              labels: [],
              context_payload: { start_date: startDate || null, due_date: dueDate || null, completion: completion === '' ? null : Number(completion) },
            });
            await onCreated();
          } catch (error) {
            toast.error((error as Error).message);
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
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            placeholder="Goals, acceptance criteria, useful context…"
            value={description}
            maxLength={10000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Normal</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Urgent</option>
              <option value="NONE">No priority</option>
            </select>
          </label>
          <label>
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="MANUAL">Manual</option>
              <option value="TICKET">Support ticket</option>
              <option value="GITHUB_ISSUE">GitHub issue</option>
              <option value="GITHUB_PR">GitHub pull request</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Start date<input type="date" value={startDate} max={dueDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>Due date<input type="date" value={dueDate} min={startDate || undefined} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
        <label>Progress (%)<input type="number" min={0} max={100} step={1} value={completion} placeholder="0" onChange={(event) => setCompletion(event.target.value)} /></label>
        <label className="agent-queue-option">
          <input
            type="checkbox"
            checked={isAgentTask}
            onChange={(event) => setIsAgentTask(event.target.checked)}
          />
          <span>
            <strong>Make available to an external worker</strong>
            <small>The worker fetches queued tasks using its agent key.</small>
          </span>
        </label>
        {isAgentTask && (
          <label>
            Agent key
            <input
              required
              minLength={1}
              maxLength={40}
              pattern="[a-z][a-z0-9_-]*"
              placeholder="e.g. backend"
              value={agentKey}
              onChange={(event) => setAgentKey(event.target.value)}
            />
            <small>Use the same key configured in the third-party worker.</small>
          </label>
        )}
        <div className="form-info">
          <SquareTerminal size={16} />
          <span>
            {isAgentTask
              ? `Task will be queued for ${agentKey || 'the selected worker'}.`
              : 'Task will be added to this project for your team.'}
          </span>
        </div>
        <div className="form-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="primary" disabled={saving}>
            {saving ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
            {parentTaskId ? 'Add subtask' : 'Create task'}
          </Button>
        </div>
      </form>
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
