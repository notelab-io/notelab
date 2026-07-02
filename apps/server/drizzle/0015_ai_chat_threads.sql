CREATE TABLE "ai_chat_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_thread" ADD CONSTRAINT "ai_chat_thread_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chat_thread" ADD CONSTRAINT "ai_chat_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_thread_id_ai_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_chat_thread"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_chat_thread_org_user_activity_idx" ON "ai_chat_thread" USING btree ("organization_id","user_id","deleted_at","last_activity_at");
--> statement-breakpoint
CREATE INDEX "ai_chat_message_thread_created_idx" ON "ai_chat_message" USING btree ("thread_id","created_at");