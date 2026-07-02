CREATE TABLE "comment_message" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by_id" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
INSERT INTO "comment_thread" (
	"id",
	"organization_id",
	"workspace_id",
	"created_by_id",
	"created_at",
	"updated_at",
	"last_activity_at"
)
SELECT
	'workspace-comment-thread-' || "workspace_id",
	"organization_id",
	"workspace_id",
	(array_agg("author_id" ORDER BY "created_at", "id"))[1],
	MIN("created_at"),
	COALESCE(MAX("updated_at"), MAX("created_at")),
	COALESCE(MAX("updated_at"), MAX("created_at"))
FROM "workspace_comment"
WHERE "deleted_at" IS NULL
GROUP BY "organization_id", "workspace_id";--> statement-breakpoint
INSERT INTO "comment_message" (
	"id",
	"thread_id",
	"author_id",
	"body",
	"edited_at",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	'workspace-comment-thread-' || "workspace_id",
	"author_id",
	"body",
	"edited_at",
	"created_at",
	"updated_at"
FROM "workspace_comment"
WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP TABLE "workspace_comment" CASCADE;--> statement-breakpoint
ALTER TABLE "comment_message" ADD CONSTRAINT "comment_message_thread_id_comment_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."comment_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_message" ADD CONSTRAINT "comment_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_message_thread_created_idx" ON "comment_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_thread_workspace_deleted_idx" ON "comment_thread" USING btree ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "comment_thread_organization_workspace_idx" ON "comment_thread" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "comment_thread_workspace_state_activity_idx" ON "comment_thread" USING btree ("workspace_id","resolved_at","last_activity_at");
