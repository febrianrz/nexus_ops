ALTER TABLE "tasks"
ADD CONSTRAINT "task_workspace_project_required"
CHECK ("workspace_id" IS NULL OR "project_id" IS NOT NULL);
