ALTER TABLE "actors" DROP CONSTRAINT "actors_owner_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_owner_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_owner_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_workspace_idx" ON "task_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_workspace_idx" ON "tasks" USING btree ("workspace_id");