import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
export const actorType = pgEnum('actor_type', ['HUMAN', 'AGENT']);
export const actorStatus = pgEnum('actor_status', ['IDLE', 'EXECUTING', 'OFFLINE']);
export const taskState = pgEnum('task_state', [
  'TRIAGE',
  'QUEUED',
  'EXECUTING',
  'WAITING_HUMAN',
  'BLOCKED',
  'DONE',
]);
export const priority = pgEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NONE']);
export const sourceType = pgEnum('source_type', ['TICKET', 'GITHUB_ISSUE', 'GITHUB_PR', 'MANUAL']);
export const eventType = pgEnum('event_type', [
  'COMMENT',
  'DELEGATION',
  'STATE_CHANGE',
  'TOOL_CALL_LOG',
  'CIRCUIT_BREAKER',
]);
export const actors = pgTable(
  'actors',
  {
    id: text().primaryKey(),
    handle: text().notNull(),
    workspace_id: text().references((): AnyPgColumn => workspaces.id, { onDelete: 'cascade' }),
    owner_user_id: text().references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    display_name: text().notNull(),
    type: actorType().notNull(),
    avatar_url: text(),
    parent_agent_id: text().references((): AnyPgColumn => actors.id),
    capabilities: jsonb().$type<string[]>().notNull().default([]),
    webhook_url: text(),
    api_key_hash: text(),
    status: actorStatus().notNull().default('IDLE'),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('actor_workspace_handle_unique').on(t.workspace_id, t.handle),
    index('actor_owner_idx').on(t.owner_user_id),
  ],
);
export const tasks = pgTable(
  'tasks',
  {
    id: text().primaryKey(),
    workspace_id: text().references((): AnyPgColumn => workspaces.id, { onDelete: 'cascade' }),
    owner_user_id: text().references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    project_id: text().references((): AnyPgColumn => projects.id, { onDelete: 'set null' }),
    parent_task_id: text().references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    is_agent_task: boolean().notNull().default(false),
    agent_key: text(),
    title: text().notNull(),
    description: text().notNull().default(''),
    state: taskState().notNull().default('TRIAGE'),
    priority: priority().notNull().default('MEDIUM'),
    source_type: sourceType().notNull(),
    source_ref: text().notNull(),
    source_url: text(),
    assignee_id: text().references(() => actors.id),
    delegated_by_id: text().references(() => actors.id),
    hop_count: integer().notNull().default(0),
    max_hops: integer().notNull().default(4),
    lock_token: text(),
    confidence_score: doublePrecision(),
    live_activity_text: text(),
    context_payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    labels: jsonb().$type<string[]>().notNull().default([]),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'hop_bounds',
      sql`${t.hop_count} >= 0 AND ${t.hop_count} <= ${t.max_hops} AND ${t.max_hops} > 0`,
    ),
    check(
      'confidence_bounds',
      sql`${t.confidence_score} IS NULL OR (${t.confidence_score} >= 0 AND ${t.confidence_score} <= 1)`,
    ),
    check(
      'task_workspace_project_required',
      sql`${t.workspace_id} IS NULL OR ${t.project_id} IS NOT NULL`,
    ),
    index('task_workspace_idx').on(t.workspace_id),
    index('task_project_idx').on(t.project_id),
    index('task_parent_idx').on(t.parent_task_id),
    index('task_agent_queue_idx').on(t.project_id, t.agent_key, t.state),
    index('task_owner_idx').on(t.owner_user_id),
    index('task_state_idx').on(t.state),
    index('task_assignee_idx').on(t.assignee_id),
  ],
);
export const taskEvents = pgTable(
  'task_events',
  {
    id: text().primaryKey(),
    workspace_id: text().references((): AnyPgColumn => workspaces.id, { onDelete: 'cascade' }),
    owner_user_id: text().references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    task_id: text()
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    actor_id: text()
      .notNull()
      .references(() => actors.id),
    event_type: eventType().notNull(),
    human_message: text().notNull(),
    mentioned_handles: jsonb().$type<string[]>().notNull().default([]),
    structured_payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('event_workspace_idx').on(t.workspace_id),
    index('event_owner_idx').on(t.owner_user_id),
    index('event_task_time_idx').on(t.task_id, t.created_at),
  ],
);

export const users = pgTable('users', {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull(),
  password_hash: text().notNull(),
  actor_id: text()
    .notNull()
    .unique()
    .references(() => actors.id),
  created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    token_hash: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires_at: timestamp({ mode: 'string', withTimezone: true }).notNull(),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('session_user_idx').on(t.user_id), index('session_expiry_idx').on(t.expires_at)],
);

export const authLimits = pgTable('auth_limits', {
  key: text().primaryKey(),
  attempts: integer().notNull().default(1),
  resets_at: timestamp({ mode: 'string', withTimezone: true }).notNull(),
});

export const workspaceRole = pgEnum('workspace_role', ['admin', 'member']);
export const workspaces = pgTable('workspaces', {
  id: text().primaryKey(),
  name: text().notNull(),
  created_by: text().references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
});
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole().notNull(),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspace_member_unique').on(t.workspace_id, t.user_id),
    index('workspace_member_user_idx').on(t.user_id),
  ],
);
export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    role: workspaceRole().notNull(),
    invited_by: text().references(() => users.id, { onDelete: 'set null' }),
    expires_at: timestamp({ mode: 'string', withTimezone: true }).notNull(),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspace_invitation_email_unique').on(t.workspace_id, t.email),
    index('workspace_invitation_email_idx').on(t.email),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    created_by: text().references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('project_workspace_name_unique').on(t.workspace_id, t.name),
    index('project_workspace_idx').on(t.workspace_id),
  ],
);

const attachmentBytes = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return 'bytea'; },
});
export const taskAttachments = pgTable('task_attachments', {
  id: text().primaryKey(),
  task_id: text().notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  workspace_id: text().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  uploaded_by: text().references(() => users.id, { onDelete: 'set null' }),
  filename: text().notNull(),
  mime_type: text().notNull(),
  size: integer().notNull(),
  content: attachmentBytes().notNull(),
  object_url: text(),
  created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('task_attachment_task_idx').on(table.task_id), check('attachment_size_bounds', sql`${table.size} >= 0 AND ${table.size} <= 10485760`)]);

export const developerKeys = pgTable('developer_keys', {
  id: text().primaryKey(),
  workspace_id: text().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  created_by: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  prefix: text().notNull(),
  token_hash: text().notNull(),
  created_at: timestamp({ mode: 'string', withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp({ mode: 'string', withTimezone: true }).notNull(),
  last_used_at: timestamp({ mode: 'string', withTimezone: true }),
  revoked_at: timestamp({ mode: 'string', withTimezone: true }),
}, (table) => [uniqueIndex('developer_key_hash_unique').on(table.token_hash), index('developer_key_workspace_idx').on(table.workspace_id)]);
