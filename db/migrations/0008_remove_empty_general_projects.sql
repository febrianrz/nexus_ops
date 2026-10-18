DELETE FROM "projects" AS project
WHERE project."name" = 'General'
  AND NOT EXISTS (
    SELECT 1
    FROM "tasks" AS task
    WHERE task."project_id" = project."id"
  );
