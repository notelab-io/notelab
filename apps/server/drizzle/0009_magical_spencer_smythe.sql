CREATE TABLE "workspace_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_comment" ADD CONSTRAINT "workspace_comment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_comment" ADD CONSTRAINT "workspace_comment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_comment" ADD CONSTRAINT "workspace_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_comment_workspace_deleted_created_idx" ON "workspace_comment" USING btree ("workspace_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "workspace_comment_organization_workspace_idx" ON "workspace_comment" USING btree ("organization_id","workspace_id");
