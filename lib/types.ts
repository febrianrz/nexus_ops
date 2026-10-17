export type ActorType = 'HUMAN' | 'AGENT';
export type ActorStatus = 'IDLE' | 'EXECUTING' | 'OFFLINE';
export type TaskState = 'TRIAGE' | 'QUEUED' | 'EXECUTING' | 'WAITING_HUMAN' | 'BLOCKED' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SourceType = 'TICKET' | 'GITHUB_ISSUE' | 'GITHUB_PR' | 'MANUAL';
export interface Actor {
  id: string;
  handle: string;
  display_name: string;
  type: ActorType;
  avatar_url: string | null;
  parent_agent_id: string | null;
  capabilities: string[];
  webhook_url: string | null;
  api_key_hash: string | null;
  status: ActorStatus;
  created_at: string;
}
export interface Context {
  repo?: string;
  branch?: string;
  test_command?: string;
  acceptance_criteria?: string[];
  diff_summary?: string;
  [key: string]: unknown;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  state: TaskState;
  priority: Priority;
  source_type: SourceType;
  source_ref: string;
  source_url: string | null;
  assignee_id: string | null;
  delegated_by_id: string | null;
  hop_count: number;
  max_hops: number;
  lock_token: string | null;
  confidence_score: number | null;
  live_activity_text: string | null;
  context_payload: Context;
  labels: string[];
  created_at: string;
  updated_at: string;
}
export type EventType =
  'COMMENT' | 'DELEGATION' | 'STATE_CHANGE' | 'TOOL_CALL_LOG' | 'CIRCUIT_BREAKER';
export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: EventType;
  human_message: string;
  mentioned_handles: string[];
  structured_payload: Record<string, unknown>;
  created_at: string;
}
export interface Workspace {
  next_task_id?: string;
  actors: Actor[];
  tasks: Task[];
  events: TaskEvent[];
}
export type PublicActor = Omit<Actor, 'api_key_hash' | 'webhook_url'>;
