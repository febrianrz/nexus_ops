CREATE TABLE "task_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "uploaded_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size" integer NOT NULL,
  "content" bytea NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attachment_size_bounds" CHECK ("size" >= 0 AND "size" <= 10485760)
);
CREATE INDEX "task_attachment_task_idx" ON "task_attachments" ("task_id");
