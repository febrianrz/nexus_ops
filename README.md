# NexusOps

A PostgreSQL-backed task workspace with multiple projects, subtasks, and an external worker queue, built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Zustand, Sonner, Zod, and Drizzle.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Next.js. Port 3000 is preferred; Next.js chooses another free port when necessary. The configured workspace uses PostgreSQL at `localhost:5435`, database `nexusops_taskmanager`, with the local `postgres` user. Legacy example data is retained separately from account-owned workspaces. PostgreSQL is required for account authentication; the local JSON workspace fallback is retained for isolated protocol tests. Sample repositories, test results, and pull requests are illustrative.

Each workspace can contain multiple projects. Tasks and subtasks belong to one project; tasks marked for an external worker enter a keyed queue that third-party applications can claim through the API. The app does not register or run workers. Project boards, activity, search (`⌘K`), task creation (`N`), comments, JSON context, and human review are interactive. Preferences include dark and light themes.

## PostgreSQL deployment

Set these environment variables in your deployment environment:

```sh
DATABASE_URL=postgres://user:password@host:5432/nexusops
NEXUS_ADMIN_TOKEN=<a-long-random-admin-secret>
NEXUS_WORKER_TOKEN=<a-separate-random-worker-secret>
NEXUS_WEBHOOK_SECRET=<a-separate-random-webhook-secret>
NEXUS_DEMO_MODE=false
```

Then provision the schema and seed the workspace:

```sh
npx drizzle-kit migrate
npm run db:seed
npm run build
npm start
```

The checked-in initial SQL migration is in `db/migrations/`. Drizzle CLI, database scripts, and Next.js load `.env.local`; exported shell variables take precedence. The local configuration connects to PostgreSQL and requires account authentication. Set `NEXUS_DEMO_MODE=false` and configure administrator credentials for production. To import an existing local snapshot into an empty database, run `npm run db:import-local -- .data/workspace.json`; the source file is preserved.

## Authentication

Open `/register` to create an account, or `/login` to sign in. Each account gets an isolated personal workspace containing only its own human identity. New accounts have zero tasks, events, or worker registrations. Create projects and tasks explicitly; normal workspace reads never seed sample data. Task, project and event access is scoped by `workspace_id` and validated workspace membership in PostgreSQL. Task IDs remain globally unique. The original sample records are retained with a null owner and are inaccessible to normal account sessions. `npm run db:seed` only populates that isolated legacy integration workspace when empty.
Passwords require 12–128 characters and matching confirmation. They use per-password random salts and Node.js scrypt (N=131072, r=8, p=1); plaintext passwords are never stored. Sessions use random opaque tokens, stored only as SHA-256 hashes in PostgreSQL. The HttpOnly, SameSite=Lax cookie expires after seven days and uses Secure on HTTPS and production hosts other than loopback. Production must be served over HTTPS. Login rotates the browser’s existing session; logout deletes it server-side. Expired/revoked cookies cannot access the workspace or protected APIs. Mutations authenticated with cookies require a matching Origin. Login and registration have persistent database-backed rate limits.

The workspace displays the signed-in user and writes their human identity to comments and approval events. Use **Log out** in the header or workspace settings. The old demo header and browser administrator-token prompt no longer bypass login. `NEXUS_DEMO_MODE` only controls whether local-file workspace storage is allowed; authentication always requires PostgreSQL.

Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/session`. External worker applications use `NEXUS_WORKER_TOKEN` and an explicit `X-Nexus-Workspace` header. No worker identity registration is needed. Admin integrations continue to use `NEXUS_ADMIN_TOKEN`. Email verification and password recovery are not included in this register/login/logout feature.

Password and session implementation follows the [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) guidance.

Production storage requires PostgreSQL. Local JSON storage serializes writes and uses atomic file replacement, and is intended for a single development/demo process. PostgreSQL uses database transactions and a transaction-scoped advisory lock to serialize handoffs across instances.

## Projects and external workers

Each workspace starts with a `General` project. Create more projects from the project selector; task and subtask records carry `project_id`, and subtasks also carry `parent_task_id`. Existing workspace tasks are assigned to `General` by migration 0005.

To route a task to a third-party worker, create it with `is_agent_task: true` and an `agent_key` such as `backend`. Workers poll and atomically claim tasks by project and key. The claim response includes a one-time `lock_token`; send it with telemetry updates. Set `state` to `EXECUTING`, `WAITING_HUMAN`, or `DONE` as work progresses. A human can approve tasks awaiting review from the dashboard.

Worker endpoints accept `Authorization: Bearer <NEXUS_WORKER_TOKEN>` and require `X-Nexus-Workspace`. Admin integrations use `NEXUS_ADMIN_TOKEN`; cookie-authenticated users use their session.

| Method | Endpoint                                                      | Behavior                                                                                           |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/workspace`                                           | Workspace snapshot with projects, tasks, safe human identities, and events                         |
| POST   | `/api/v1/projects`                                            | Create a project in the selected workspace                                                         |
| POST   | `/api/v1/ingest`                                              | Create a task or subtask; accepts `project_id`, `parent_task_id`, `is_agent_task`, and `agent_key` |
| GET    | `/api/v1/agent/tasks?project_id=<id>&agent_key=<key>&limit=5` | Atomically claim queued tasks for an external worker                                               |
| PATCH  | `/api/v1/tasks/:id/telemetry`                                 | Update worker activity, confidence, state, and tool-call logs using the claim lock token           |
| POST   | `/api/v1/tasks/:id/events`                                    | Add a human comment                                                                                |
| PATCH  | `/api/v1/tasks/:id`                                           | Human approval or queue action                                                                     |

Example worker poll:

```sh
curl "$NEXUS_URL/api/v1/agent/tasks?project_id=$NEXUS_PROJECT_ID&agent_key=backend&limit=5" \
  -H "Authorization: Bearer $NEXUS_WORKER_TOKEN" \
  -H "X-Nexus-Workspace: $NEXUS_WORKSPACE_ID"
```

Use each returned task's `lock_token` when reporting progress:

```sh
curl -X PATCH "$NEXUS_URL/api/v1/tasks/NEX-104/telemetry" \
  -H "Authorization: Bearer $NEXUS_WORKER_TOKEN" \
  -H "X-Nexus-Workspace: $NEXUS_WORKSPACE_ID" \
  -H 'Content-Type: application/json' \
  -d '{"state":"DONE","lock_token":"<claim-lock-token>","live_activity_text":"Completed"}'
```

## GitHub and ticket ingestion

Configure a GitHub webhook with the payload URL `https://<your-host>/api/v1/ingest`, JSON content, and the same secret as `NEXUS_WEBHOOK_SECRET`. Subscribe to Issues and Pull requests. The endpoint verifies GitHub’s raw-body HMAC signature and processes `opened` and `reopened` events. Repeated source type/reference pairs return the existing task within the selected project. Include `project_id` to route incoming work to a specific project; omitted values target `General`.

Custom ticket sources send normalized `title`, `source_type`, `source_ref`, and optional `description`, `priority`, `labels`, `source_url`, and `context_payload`. Use an administrator bearer token or the equivalent raw-body `X-Nexus-Signature: sha256=<hmac>` signature.

The workspace does not call a model, execute repository tools, or merge GitHub pull requests. A real repository merge and worker execution require your third-party application and integration credentials.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Nineteen tests cover identity scoping, authentication boundaries, strict request validation, signed GitHub payload normalization, source deduplication, telemetry, approval, ownership checks, loop prevention, and human reset. API integration tests use isolated temporary storage and never modify the demo workspace. When a development server is running, use `NEXUS_BUILD_DIR=.next-build npm run build` to isolate build artifacts from its hot-reload directory.

Run `npm run test:auth` against the running development server for the PostgreSQL authentication smoke test (override the target with `NEXUS_TEST_URL`). It creates a temporary `@example.test` account, verifies registration/login/session expiry/logout and guest access, then removes its own account and actor. Existing users and tasks are preserved.

## Workspace isolation regression

Run `npm run test:isolation` against the development server (or set `NEXUS_TEST_URL`). It creates two temporary accounts, verifies empty registration, independent project and source references, persisted counts, and rejection of cross-account project/task/event/telemetry access. Its own users and owned test data are removed afterward.

An environment administrator token targets the legacy integration workspace by default. Set `X-Nexus-Workspace` to a workspace ID to target an explicit workspace. Cookie sessions may select this header only for workspaces they belong to. Worker tokens require an explicit workspace selector. Signed webhooks target `NEXUS_WEBHOOK_WORKSPACE_ID` on the server; otherwise they remain in the legacy integration workspace. The old `X-Nexus-Owner` administrator header and `NEXUS_WEBHOOK_OWNER_ID` setting remain aliases for pre-existing personal workspace IDs.

## Shared workspaces and invitations

Use the workspace name at the top of the sidebar to switch workspaces, create a new workspace, and accept or decline invitations. The selected workspace is remembered per signed-in account in this browser. A creator automatically becomes an admin. Existing personal workspaces and their data are migrated in place by migration 0003; legacy sample data remains separate.

Open **Members & settings** to view members, create invitations by a registered user's email, choose admin/member, revoke pending invitations, change roles, or remove members. Invitations appear only in the matching user's app, require acceptance, expire after seven days, and send no email. Ask new teammates to register before inviting them. Admins manage membership; workspace members can create projects, tasks, and subtasks, comment, and review tasks. The server protects the last admin and immediately enforces removal or demotion. Removing a member preserves workspace tasks and events.

`GET /api/v1/workspaces` returns accessible workspaces, the current membership list, incoming invitations, and (for admins) pending invitations. `POST /api/v1/workspaces` accepts strict action payloads: `create`, `rename`, `invite`, `respond`, `role`, `remove`, and `revoke`. Workspace-scoped snapshot and mutation endpoints use `X-Nexus-Workspace`; omitted selectors default to the personal workspace, or the earliest remaining membership if personal access was removed.

Run `npm run test:workspaces` against the local server (or set `NEXUS_TEST_URL`) to verify multiple workspaces, shared tasks/comments, invitation acceptance and expiry, role boundaries, last-admin protection, revocation, removal, and CSRF rejection. Temporary accounts and workspaces are cleaned up afterward.

For upgrades from the previous per-account schema (migration 0002), apply migrations 0003 through 0007 in order. These migrations backfill existing personal workspace memberships and ownership, create project assignments for existing tasks, move legacy agent-assigned work into the external queue, and enforce project assignment for workspace tasks. Schema-only `db:push` does not perform those data migrations.

### Task attachments

Open a task, subtask, or sub-subtask and use **Attachments** to select multiple files or drag files into the upload area. Review the queue and click **Upload**. Each request accepts up to 10 files, 10 MB per file, and 25 MB total. Files remain available after reloading and can be downloaded individually.

Migration `0010_task_attachments` stores metadata and binary content in PostgreSQL. Attachment listing, uploading, and downloading require a signed-in workspace member; file URLs are authenticated, and downloads are served as attachments. Apply migrations with `npx drizzle-kit migrate`. Run `npm run test:attachments` against the local app to verify multiple uploads across all three levels, binary persistence, downloads, upload limits, and workspace isolation using temporary accounts that are cleaned up afterward.

### Developer API keys

Open the account menu at the top-right → **Developer**. Workspace admins can create a named key with a 30-, 90-, or 365-day lifetime and revoke keys. The full key appears once; only a SHA-256 hash, prefix, and lifecycle metadata are stored in PostgreSQL. Migration `0011_developer_keys` adds this storage. The old bottom sidebar account menu has moved to the top-right account menu, including workspace settings, integrations, members, help, and logout.

Developer keys are workspace-bound **external-worker** credentials. Use `Authorization: Bearer YOUR_API_KEY` to claim tasks through `/api/v1/agent/tasks?project_id=PROJECT_ID&agent_key=AGENT_KEY`, then report telemetry through `/api/v1/tasks/TASK_ID/telemetry` with the returned worker lock token. A workspace header is optional for these keys; if present, it must match the key’s workspace. Keys do not grant human-management access to keys, members, or task fields. Existing environment-based service tokens remain supported.

Revoked or expired keys are rejected. Keys also stop working if their creator loses workspace admin membership. `npm run test:developer` verifies creation, hashing and redacted listings, real claim/telemetry calls, revocation, expiry, member restrictions, demotion, and workspace isolation with disposable accounts and cleanup.

### AI agent identities

Open the top-right account menu → **AI agents**. Workspace admins can add, edit and remove agent display names and unique usernames. Agents are labels backed by PostgreSQL actor records; creation does not generate credentials, run AI, or register a runtime. Removal hides the identity while preserving historical events and tasks, and clears its assignments.

The Assignee picker in project rows and task details supports workspace members or agent identities at all three task levels. Agent assignment sets `is_agent_task=true` and `agent_key` to the username, queues unfinished tasks, and clears previous worker claims. Human assignment clears agent routing; completed tasks stay completed. Renaming an agent updates its assigned tasks and invalidates previous claims. Selecting the same assignee leaves active claims intact.

External apps authenticate with a Developer API key and claim work with `GET /api/v1/agent/tasks?project_id=PROJECT_ID&agent_key=USERNAME`. Agent management uses `GET /api/v1/agents` and `POST /api/v1/agents` actions `create`, `update`, `delete`; task assignment uses `PATCH /api/v1/tasks/:id` with `{ "action": "set-assignee", "assignee_id": "ACTOR_ID" }` (use JSON `null` to clear). Members may assign tasks; only admins may manage identities. Run `npm run test:agents` for disposable PostgreSQL integration coverage.

## REST API and MCP

The interactive REST reference is available at `/developer/docs` and is powered by Scalar. The machine-readable OpenAPI document is available at `/api/openapi`. Developer API keys use `Authorization: Bearer nxo_...`; they are workspace-bound and can claim agent tasks, read the workspace task graph, report telemetry, and manage AI agent labels through `GET/POST /api/v1/agents`. Agent management is allowed only while the key creator remains a workspace admin. The REST contract is intentionally MCP-friendly: an MCP server or connector can expose the documented operations as tools without needing to run AI inside NexusOps.
