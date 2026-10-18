UPDATE "tasks"
SET "state" = CASE
      WHEN "state" IN ('TRIAGE', 'EXECUTING') THEN 'QUEUED'::task_state
      ELSE "state"
    END,
    "assignee_id" = NULL,
    "delegated_by_id" = NULL,
    "lock_token" = NULL,
    "live_activity_text" = CASE
      WHEN "state" IN ('TRIAGE', 'EXECUTING') THEN 'Waiting for external worker'
      ELSE "live_activity_text"
    END
WHERE "workspace_id" IS NOT NULL
  AND "is_agent_task" = true;
