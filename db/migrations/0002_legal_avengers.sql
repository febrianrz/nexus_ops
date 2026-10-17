ALTER TABLE "actors" DROP CONSTRAINT "actors_handle_unique";--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "task_events" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actor_owner_handle_unique" ON "actors" USING btree ("owner_user_id","handle");--> statement-breakpoint
CREATE INDEX "actor_owner_idx" ON "actors" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "event_owner_idx" ON "task_events" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "task_owner_idx" ON "tasks" USING btree ("owner_user_id");
--> statement-breakpoint
UPDATE actors AS actor SET owner_user_id = account.id FROM users AS account WHERE account.actor_id = actor.id;
