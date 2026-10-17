CREATE TYPE "public"."actor_status" AS ENUM('IDLE', 'EXECUTING', 'OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('HUMAN', 'AGENT');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('COMMENT', 'DELEGATION', 'STATE_CHANGE', 'TOOL_CALL_LOG', 'CIRCUIT_BREAKER');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('TICKET', 'GITHUB_ISSUE', 'GITHUB_PR', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."task_state" AS ENUM('TRIAGE', 'QUEUED', 'EXECUTING', 'WAITING_HUMAN', 'BLOCKED', 'DONE');--> statement-breakpoint
CREATE TABLE "actors" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"type" "actor_type" NOT NULL,
	"avatar_url" text,
	"parent_agent_id" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"webhook_url" text,
	"api_key_hash" text,
	"status" "actor_status" DEFAULT 'IDLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actors_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"human_message" text NOT NULL,
	"mentioned_handles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structured_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"state" "task_state" DEFAULT 'TRIAGE' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_ref" text NOT NULL,
	"source_url" text,
	"assignee_id" text,
	"delegated_by_id" text,
	"hop_count" integer DEFAULT 0 NOT NULL,
	"max_hops" integer DEFAULT 4 NOT NULL,
	"lock_token" text,
	"confidence_score" double precision,
	"live_activity_text" text,
	"context_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hop_bounds" CHECK ("tasks"."hop_count" >= 0 AND "tasks"."hop_count" <= "tasks"."max_hops" AND "tasks"."max_hops" > 0),
	CONSTRAINT "confidence_bounds" CHECK ("tasks"."confidence_score" IS NULL OR ("tasks"."confidence_score" >= 0 AND "tasks"."confidence_score" <= 1))
);
--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_parent_agent_id_actors_id_fk" FOREIGN KEY ("parent_agent_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_actors_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_delegated_by_id_actors_id_fk" FOREIGN KEY ("delegated_by_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_task_time_idx" ON "task_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_state_idx" ON "tasks" USING btree ("state");--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "tasks" USING btree ("assignee_id");