CREATE TABLE "workspace_access" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"access_level" text DEFAULT 'view' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_access_organization_id_idx" ON "workspace_access" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_access_workspace_id_idx" ON "workspace_access" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_access_target_idx" ON "workspace_access" USING btree ("organization_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_access_target_unique" ON "workspace_access" USING btree ("workspace_id","target_type","target_id");