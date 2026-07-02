CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"page_id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb,
	"deleted_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_property" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"property_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_row" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"page_id" text NOT NULL,
	"parent_row_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"last_edited_by_id" text,
	"deleted_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_view" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"inviter_id" text NOT NULL,
	"team_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rateLimit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"last_request" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"active_team_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamMember" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_id" text,
	"type" text DEFAULT 'pageblock' NOT NULL,
	"name" text NOT NULL,
	"url" text DEFAULT '#' NOT NULL,
	"content" jsonb,
	"metadata" jsonb,
	"deleted_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_property" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"deleted_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_property_value" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"property_id" text NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_page_id_workspace_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_property" ADD CONSTRAINT "database_property_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_property" ADD CONSTRAINT "database_property_property_id_workspace_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."workspace_property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_page_id_workspace_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_last_edited_by_id_user_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_view" ADD CONSTRAINT "database_view_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_property" ADD CONSTRAINT "workspace_property_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_property" ADD CONSTRAINT "workspace_property_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_property_value" ADD CONSTRAINT "workspace_property_value_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_property_value" ADD CONSTRAINT "workspace_property_value_property_id_workspace_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."workspace_property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "database_organization_id_idx" ON "database" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "database_page_id_idx" ON "database" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "database_deleted_at_idx" ON "database" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "database_property_database_id_idx" ON "database_property" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_property_position_idx" ON "database_property" USING btree ("database_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "database_property_database_property_unique" ON "database_property" USING btree ("database_id","property_id");--> statement-breakpoint
CREATE INDEX "database_row_database_id_idx" ON "database_row" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_row_parent_idx" ON "database_row" USING btree ("database_id","parent_row_id");--> statement-breakpoint
CREATE INDEX "database_row_position_idx" ON "database_row" USING btree ("database_id","position");--> statement-breakpoint
CREATE INDEX "database_row_page_id_idx" ON "database_row" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "database_row_deleted_at_idx" ON "database_row" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "database_row_database_page_unique" ON "database_row" USING btree ("database_id","page_id");--> statement-breakpoint
CREATE INDEX "database_view_database_id_idx" ON "database_view" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_view_position_idx" ON "database_view" USING btree ("database_id","position");--> statement-breakpoint
CREATE INDEX "workspace_organization_id_idx" ON "workspace" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_type_idx" ON "workspace" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workspace_deleted_at_idx" ON "workspace" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "workspace_property_organization_id_idx" ON "workspace_property" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_property_deleted_at_idx" ON "workspace_property" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "workspace_property_value_workspace_id_idx" ON "workspace_property_value" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_property_value_property_id_idx" ON "workspace_property_value" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_property_value_unique" ON "workspace_property_value" USING btree ("workspace_id","property_id");