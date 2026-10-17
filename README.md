# NexusOps

A hybrid human–agent engineering workspace built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Zustand, Sonner, Zod, PostgreSQL, and Drizzle.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Next.js. Port 3000 is preferred; Next.js chooses another free port when necessary. The configured workspace uses PostgreSQL at `localhost:5435`, database `nexusops_taskmanager`, with the local `postgres` user. Legacy example data is retained separately from account-owned workspaces. PostgreSQL is required for account authentication; the local JSON workspace fallback is retained for isolated protocol tests. Sample repositories, test results, and pull requests are illustrative.

The simulator dock exercises real local API operations: ingest a PR, hand off work, trip the four-hop circuit breaker, and spawn a sub-agent. Filters, board/list views, fleet online toggles, activity, search (`⌘K`), task creation (`N`), mentions, comments, JSON context, and human approval are interactive. Preferences include dark and light themes.

## PostgreSQL deployment

Set these environment variables in your deployment environment:

```sh
DATABASE_URL=postgres://user:password@host:5432/nexusops
NEXUS_ADMIN_TOKEN=<a-long-random-admin-secret>
NEXUS_WEBHOOK_SECRET=<a-separate-random-webhook-secret>
NEXUS_DEMO_MODE=false
```

Then provision the schema and seed the workspace:

```sh
npm run db:push
npm run db:seed
npm run build
npm start
```

The checked-in initial SQL migration is in `db/migrations/`. Drizzle CLI, database scripts, and Next.js load `.env.local`; exported shell variables take precedence. The local configuration connects to PostgreSQL and requires account authentication. Set `NEXUS_DEMO_MODE=false` and configure administrator credentials for production. To import an existing local snapshot into an empty database, run `npm run db:import-local -- .data/workspace.json`; the source file is preserved.

## Authentication

Open `/register` to create an account, or `/login` to sign in. Each account gets an isolated personal workspace containing only its own human identity. New accounts have zero tasks, events, or agents. Register agents and create tasks explicitly; normal workspace reads never seed sample data. Task, agent, event, delegation, telemetry and parent-agent access are scoped by `workspace_id` and validated workspace membership in PostgreSQL. Agent handles can be reused across workspaces; task IDs remain globally unique. The original sample records are retained with a null owner and are inaccessible to normal account sessions. `npm run db:seed` only populates that isolated legacy integration workspace when empty.
Passwords require 12–128 characters and matching confirmation. They use per-password random salts and Node.js scrypt (N=131072, r=8, p=1); plaintext passwords are never stored. Sessions use random opaque tokens, stored only as SHA-256 hashes in PostgreSQL. The HttpOnly, SameSite=Lax cookie expires after seven days and uses Secure on HTTPS and production hosts other than loopback. Production must be served over HTTPS. Login rotates the browser’s existing session; logout deletes it server-side. Expired/revoked cookies cannot access the workspace or protected APIs. Mutations authenticated with cookies require a matching Origin. Login and registration have persistent database-backed rate limits.

The workspace displays the signed-in user and writes their human identity to comments and approval events. Use **Log out** in the header or workspace settings. The old demo header and browser administrator-token prompt no longer bypass login. `NEXUS_DEMO_MODE` only controls whether local-file workspace storage is allowed; authentication always requires PostgreSQL.

Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/session`. Machine agents still use their scoped bearer tokens, and external administrator integrations can use `NEXUS_ADMIN_TOKEN`. Email verification and password recovery are not included in this register/login/logout feature.

Password and session implementation follows the [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) guidance.

Production storage requires PostgreSQL. Local JSON storage serializes writes and uses atomic file replacement, and is intended for a single development/demo process. PostgreSQL uses database transactions and a transaction-scoped advisory lock to serialize handoffs across instances.

## Agent protocol

Machine endpoints accept `Authorization: Bearer <token>`. Browser users authenticate with their session cookie. Administrator credentials can manage the workspace; agents can update/delegate their assigned tasks and spawn their own children. Workspace reads with an agent token only return that agent’s assigned tasks and events. Actor discovery omits credential hashes and webhook configuration.

| Method | Endpoint                      | Behavior                                                      |
| ------ | ----------------------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/workspace`           | Workspace snapshot, safe identities, task events              |
| POST   | `/api/v1/actors/agents`       | Register an agent; return a scoped token once                 |
| PATCH  | `/api/v1/actors/:id`          | Administrator changes online status                           |
| POST   | `/api/v1/ingest`              | Normalize a task, support ticket, GitHub issue or PR          |
| POST   | `/api/v1/tasks/:id/delegate`  | Handoff through `target_handle` or a structured `@mention`    |
| PATCH  | `/api/v1/tasks/:id/telemetry` | Update activity, confidence, review state, and tool-call logs |
| POST   | `/api/v1/tasks/:id/events`    | Comment with structured mentioned handles                     |
| PATCH  | `/api/v1/tasks/:id`           | Administrator `approve`, `resume`, or `queue` action          |

Example registration:

```sh
curl "$NEXUS_URL/api/v1/actors/agents" \
  -H "Authorization: Bearer $NEXUS_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"handle":"@bot-reviewer","display_name":"Code reviewer","capabilities":["typescript","review"]}'
```

Example handoff with an assigned agent’s token:

```sh
curl "$NEXUS_URL/api/v1/tasks/NEX-102/delegate" \
  -H "Authorization: Bearer $NEXUS_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"target_handle":"@bot-qa","message":"Implementation ready. @bot-qa please verify."}'
```

At the fourth handoff, the transaction pauses execution, preserves the current assignee, clears the lock, and logs a `CIRCUIT_BREAKER` event. Subsequent delegation/telemetry is rejected. A human `resume` resets the hop budget; approval marks a review task complete. Bots cannot approve work.

## GitHub and ticket ingestion

Configure a GitHub webhook with the payload URL `https://<your-host>/api/v1/ingest`, JSON content, and the same secret as `NEXUS_WEBHOOK_SECRET`. Subscribe to Issues and Pull requests. The endpoint verifies GitHub’s raw-body HMAC signature and processes `opened` and `reopened` events. Repeated source type/reference pairs return the existing task.

Custom ticket sources send normalized `title`, `source_type`, `source_ref`, and optional `description`, `priority`, `labels`, `source_url`, and `context_payload`. Use an administrator bearer token or the equivalent raw-body `X-Nexus-Signature: sha256=<hmac>` signature.

The workspace does not call a model, execute repository tools, or merge GitHub pull requests. Simulator output is explicitly demonstration data. “Approve & merge” marks the task done and tells the user to merge in GitHub. A real repository merge and agent execution require your workers/integration credentials. Registered `webhook_url` values are stored for future workers; this MVP does not dispatch external callbacks.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Nineteen tests cover identity scoping, authentication boundaries, strict request validation, signed GitHub payload normalization, source deduplication, telemetry, approval, ownership checks, loop prevention, and human reset. API integration tests use isolated temporary storage and never modify the demo workspace. When a development server is running, use `NEXUS_BUILD_DIR=.next-build npm run build` to isolate build artifacts from its hot-reload directory.

Run `npm run test:auth` against the running development server for the PostgreSQL authentication smoke test (override the target with `NEXUS_TEST_URL`). It creates a temporary `@example.test` account, verifies registration/login/session expiry/logout and guest access, then removes its own account and actor. Existing users and tasks are preserved.

## Workspace isolation regression

Run `npm run test:isolation` against the development server (or set `NEXUS_TEST_URL`). It creates two temporary accounts, verifies empty registration, independent agent handles/source references, persisted counts, and rejection of cross-account task/actor/event/delegation/telemetry access. Its own users and owned test data are removed afterward.

An environment administrator token targets the legacy integration workspace by default. Set `X-Nexus-Workspace` to a workspace ID to target an explicit workspace. Cookie sessions may select this header only for workspaces they belong to; agent tokens always derive their workspace from their registered identity and ignore forged selectors. Signed webhooks target `NEXUS_WEBHOOK_WORKSPACE_ID` on the server; otherwise they remain in the legacy integration workspace. The old `X-Nexus-Owner` administrator header and `NEXUS_WEBHOOK_OWNER_ID` setting remain aliases for pre-existing personal workspace IDs.


## Shared workspaces and invitations

Use the workspace name at the top of the sidebar to switch workspaces, create a new workspace, and accept or decline invitations. The selected workspace is remembered per signed-in account in this browser. A creator automatically becomes an admin. Existing personal workspaces and their data are migrated in place by migration 0003; legacy sample data remains separate.

Open **Members & settings** to view members, create invitations by a registered user's email, choose admin/member, revoke pending invitations, change roles, or remove members. Invitations appear only in the matching user's app, require acceptance, expire after seven days, and send no email. Ask new teammates to register before inviting them. Admins manage membership and agent registration/status; members can create, comment on, delegate, and review tasks. The server protects the last admin and immediately enforces removal or demotion. Removing a member preserves workspace tasks and events.

`GET /api/v1/workspaces` returns accessible workspaces, the current membership list, incoming invitations, and (for admins) pending invitations. `POST /api/v1/workspaces` accepts strict action payloads: `create`, `rename`, `invite`, `respond`, `role`, `remove`, and `revoke`. Workspace-scoped snapshot and mutation endpoints use `X-Nexus-Workspace`; omitted selectors default to the personal workspace, or the earliest remaining membership if personal access was removed.

Run `npm run test:workspaces` against the local server (or set `NEXUS_TEST_URL`) to verify multiple workspaces, shared tasks/comments, invitation acceptance and expiry, role boundaries, last-admin protection, revocation, removal, and CSRF rejection. Temporary accounts and workspaces are cleaned up afterward.

For upgrades from the previous per-account schema (migration 0002), apply `db/migrations/0003_youthful_praxagora.sql` and `0004_clever_vulture.sql` in order as one PostgreSQL transaction. These migrations backfill existing personal workspace memberships and ownership; schema-only `db:push` does not perform that data migration.
