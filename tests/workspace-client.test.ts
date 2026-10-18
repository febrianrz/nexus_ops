import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useWorkspace } from '../lib/client';
import type { Project } from '../lib/types';

const team = (id: string) => ({ workspaces: [{ id, name: id, role: 'admin' }], current: { id, name: id, role: 'admin' }, members: [], pending: [], invitations: [] });
const data = (id: string) => ({ projects: [{ id: `${id}-project`, workspace_id: id }], tasks: [], actors: [], events: [], storage: 'postgresql' });
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

test('workspace switch clears the previous project list before loading the destination', async () => {
  const original = globalThis.fetch;
  let resolveTeam!: (value: Response) => void;
  globalThis.fetch = async (input) => String(input).endsWith('/workspaces') ? new Promise<Response>((resolve) => { resolveTeam = resolve; }) : response(data('B'));
  useWorkspace.setState({ workspaceId: 'A', projects: [{ id: 'A-project', workspace_id: 'A' } as Project], selectedProjectId: 'A-project', loaded: true });
  const switching = useWorkspace.getState().switchWorkspace('B');
  try {
    assert.deepEqual(useWorkspace.getState().projects, []);
    assert.equal(useWorkspace.getState().selectedProjectId, null);
  } finally {
    resolveTeam(response(team('B')));
    await switching;
    globalThis.fetch = original;
  }
});

test('an older workspace response cannot overwrite a newer selected workspace', async () => {
  const original = globalThis.fetch;
  let resolveOld!: (value: Response) => void;
  let teamCalls = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/workspaces')) {
      teamCalls++;
      if (teamCalls === 1) return new Promise<Response>((resolve) => { resolveOld = resolve; });
      return response(team('B'));
    }
    return response(data('B'));
  };
  try {
    useWorkspace.setState({ workspaceId: 'A', projects: [], selectedProjectId: null });
    const old = useWorkspace.getState().refresh();
    await useWorkspace.getState().switchWorkspace('B');
    resolveOld(response(team('A')));
    await old;
    assert.equal(useWorkspace.getState().workspaceId, 'B');
    assert.equal(useWorkspace.getState().projects[0].id, 'B-project');
  } finally { globalThis.fetch = original; }
});
