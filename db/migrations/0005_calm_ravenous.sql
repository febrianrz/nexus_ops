CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_task_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_agent_task" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "agent_key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_name_unique" ON "projects" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "project_workspace_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_parent_idx" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "task_agent_queue_idx" ON "tasks" USING btree ("project_id","agent_key","state");
--> statement-breakpoint
INSERT INTO "projects" ("id", "workspace_id", "name", "description", "created_by")
SELECT "id" || '-general', "id", 'General', '', "created_by" FROM "workspaces"
ON CONFLICT ("workspace_id", "name") DO NOTHING;
--> statement-breakpoint
UPDATE "tasks" AS task
SET "project_id" = project."id"
FROM "projects" AS project
WHERE task."workspace_id" = project."workspace_id"
  AND project."name" = 'General'
  AND task."project_id" IS NULL;
--> statement-breakpoint
UPDATE "tasks" AS task
SET "is_agent_task" = true,
    "agent_key" = regexp_replace(actor."handle", '^@bot-', '')
FROM "actors" AS actor
WHERE task."assignee_id" = actor."id"
  AND actor."type" = 'AGENT'
  AND task."workspace_id" IS NOT NULL;
