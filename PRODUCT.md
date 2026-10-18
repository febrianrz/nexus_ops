# NexusOps

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, Tailwind, Framer Motion, Sonner, Zustand, PostgreSQL and Drizzle. Specified in the user's full implementation brief.

## Users

Human engineers managing projects and engineering tasks with external worker applications.

## Product Purpose

Ingest tickets, GitHub issues and pull requests into workspace projects; organize tasks and subtasks; route flagged tasks to third-party workers and review their results.

## Capabilities and Constraints

Workspace projects, project-scoped tasks and subtasks, a keyed external worker queue, task telemetry, kanban, inspector and activity. Worker registration and execution are handled by third-party applications.

## Brand Commitments

NexusOps. Crisp Linear/Raycast-inspired surfaces, clean sans-serif UI and monospace identifiers, dark and light tokens, purposeful spring motion. User-specified visual direction.

## Open Decisions

Deployment target, production identity provider and external webhook credentials have not been supplied. Local demo must work without a PostgreSQL server.

## Account Authentication

Email/password registration creates an isolated personal workspace with one empty `General` project and no tasks or events. PostgreSQL stores users, hashed passwords, sessions, and authentication rate limits. Human identities follow the signed-in account. Register, login, logout, session expiry, and protected workspace/API access are implemented.

## Data Ownership

Each account receives an empty personal workspace and can create additional workspaces. Projects, tasks and activity belong to a workspace. All APIs enforce workspace membership in PostgreSQL. Legacy sample data remains isolated from account workspaces and is never seeded on account reads.

## Workspace Membership

Workspace creators become admins. Admins invite registered users by email through in-app invitations with a selected admin/member role, manage roles and remove members. Recipients accept or decline; invitations expire after seven days and can be revoked. No email delivery is used. Workspace members create projects and tasks; membership changes require admin access. A workspace must retain one admin. Switching workspaces clears prior data before loading the selected workspace, and workspace selection is remembered per account in the browser.
