ALTER TABLE "ai_chat_thread" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "ai_chat_thread_org_user_archived_activity_idx" ON "ai_chat_thread" USING btree ("organization_id","user_id","archived_at","deleted_at","last_activity_at");