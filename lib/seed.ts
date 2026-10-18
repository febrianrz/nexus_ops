import type { Actor, Task, Workspace } from './types';
const date = new Date().toISOString();
const actor = (
  id: string,
  handle: string,
  display_name: string,
  capabilities: string[],
  status: Actor['status'],
  parent_agent_id: string | null = null,
): Actor => ({
  id,
  handle,
  display_name,
  capabilities,
  status,
  parent_agent_id,
  type: id === 'admin' ? 'HUMAN' : 'AGENT',
  avatar_url: null,
  webhook_url: null,
  api_key_hash: null,
  created_at: date,
});
const base = {
  project_id: 'demo-project',
  parent_task_id: null,
  is_agent_task: true,
  agent_key: 'worker',
  max_hops: 4,
  lock_token: null,
  delegated_by_id: null,
  source_url: null,
  confidence_score: null,
  live_activity_text: null,
  created_at: date,
  updated_at: date,
};
export function seedWorkspace(): Workspace {
  const actors = [
    actor('admin', '@admin', 'Alex Morgan', ['review', 'merge'], 'IDLE'),
    actor('triage', '@bot-triage', 'Triage agent', ['triage', 'prioritization'], 'EXECUTING'),
    actor('coder', '@bot-coder', 'Coder agent', ['typescript', 'implementation'], 'EXECUTING'),
    actor('qa', '@bot-qa', 'QA agent', ['testing', 'code review'], 'IDLE'),
    actor(
      'security',
      '@bot-sec-scanner',
      'Security scanner',
      ['security', 'dependency audit'],
      'IDLE',
      'qa',
    ),
  ];
  const tasks: Task[] = [
    {
      ...base,
      id: 'NEX-104',
      title: 'Add rate limiting to public API endpoints',
      description:
        'Protect public routes with sliding-window rate limiting. Return standard rate limit headers and a helpful retry response.',
      state: 'TRIAGE',
      priority: 'HIGH',
      source_type: 'GITHUB_ISSUE',
      source_ref: 'nexus/api#142',
      assignee_id: 'triage',
      hop_count: 0,
      labels: ['backend', 'security'],
      context_payload: {
        repo: 'nexus/api',
        branch: 'feat/api-rate-limit',
        test_command: 'npm test',
        acceptance_criteria: [
          'Limit unauthenticated requests to 100 per minute',
          'Return Retry-After on HTTP 429',
        ],
      },
    },
    {
      ...base,
      id: 'NEX-103',
      title: 'Fix timezone offset in scheduled workflows',
      description:
        'Normalize workflow schedules to UTC and preserve the user’s timezone for display.',
      state: 'QUEUED',
      priority: 'HIGH',
      source_type: 'TICKET',
      source_ref: 'SUP-284',
      assignee_id: 'coder',
      hop_count: 1,
      labels: ['bug', 'workflows'],
      context_payload: {
        repo: 'nexus/core',
        branch: 'fix/schedule-timezone',
        test_command: 'npm test -- scheduler',
      },
    },
    {
      ...base,
      id: 'NEX-102',
      title: 'Implement OAuth token refresh rotation',
      description:
        'Rotate refresh tokens on each exchange and invalidate reused token families. Add integration coverage for concurrent refresh requests.',
      state: 'EXECUTING',
      priority: 'HIGH',
      source_type: 'GITHUB_PR',
      source_ref: 'nexus/core#138',
      assignee_id: 'coder',
      delegated_by_id: 'triage',
      hop_count: 1,
      confidence_score: 0.87,
      live_activity_text: 'Running integration tests',
      labels: ['backend', 'auth'],
      context_payload: {
        repo: 'nexus/core',
        branch: 'feat/token-rotation',
        test_command: 'npm test -- auth',
        acceptance_criteria: [
          'Rotate tokens atomically',
          'Reject replayed refresh tokens',
          'Pass all authentication tests',
        ],
        diff_summary: '4 files changed, +128 −32',
      },
    },
    {
      ...base,
      id: 'NEX-101',
      title: 'Upgrade dependencies & resolve security advisories',
      description:
        'Update vulnerable packages, validate the lockfile, and review breaking changes before merging.',
      state: 'WAITING_HUMAN',
      priority: 'MEDIUM',
      source_type: 'GITHUB_PR',
      source_ref: 'nexus/web#136',
      assignee_id: 'qa',
      delegated_by_id: 'security',
      hop_count: 2,
      confidence_score: 0.98,
      labels: ['dependencies', 'security'],
      context_payload: {
        repo: 'nexus/web',
        branch: 'chore/security-updates',
        test_command: 'npm test',
        acceptance_criteria: ['No high-severity advisories', 'All tests pass'],
        diff_summary: '2 files changed, +64 −48',
      },
    },
  ];
  return {
    projects: [
      {
        id: 'demo-project',
        workspace_id: 'demo',
        name: 'General',
        description: '',
        created_by: null,
        created_at: date,
        updated_at: date,
      },
    ],
    actors,
    tasks,
    events: tasks.flatMap((task) => [
      {
        id: `evt-${task.id}-1`,
        task_id: task.id,
        actor_id: 'admin',
        event_type: 'STATE_CHANGE' as const,
        human_message: `Task received from ${task.source_type === 'TICKET' ? 'support' : 'GitHub'} and added to the workspace.`,
        mentioned_handles: [],
        structured_payload: { state: 'TRIAGE' },
        created_at: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
      },
      ...(task.hop_count
        ? [
            {
              id: `evt-${task.id}-2`,
              task_id: task.id,
              actor_id: 'triage',
              event_type: 'DELEGATION' as const,
              human_message: `Context is ready. Handing this over to ${actors.find((a) => a.id === task.assignee_id)?.handle} for ${task.state === 'WAITING_HUMAN' ? 'final review' : 'implementation'}.`,
              mentioned_handles: [actors.find((a) => a.id === task.assignee_id)?.handle ?? ''],
              structured_payload: { hop_count: task.hop_count },
              created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            },
          ]
        : []),
      ...(task.state === 'WAITING_HUMAN'
        ? [
            {
              id: 'evt-review',
              task_id: task.id,
              actor_id: 'qa',
              event_type: 'TOOL_CALL_LOG' as const,
              human_message:
                'All 24 checks passed. Dependency changes are ready for your approval.',
              mentioned_handles: ['@admin'],
              structured_payload: { tool: 'test_runner', passed: 24, failed: 0 },
              created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
            },
          ]
        : []),
    ]),
  };
}
