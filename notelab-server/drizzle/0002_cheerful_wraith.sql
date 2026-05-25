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
CREATE TABLE "database_cell" (
	"id" text PRIMARY KEY NOT NULL,
	"row_id" text NOT NULL,
	"property_id" text NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_property" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_row" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"page_id" text NOT NULL,
	"parent_row_id" text,
	"title" text NOT NULL,
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
ALTER TABLE "database" ADD CONSTRAINT "database_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_page_id_workspace_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_cell" ADD CONSTRAINT "database_cell_row_id_database_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."database_row"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_cell" ADD CONSTRAINT "database_cell_property_id_database_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."database_property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_property" ADD CONSTRAINT "database_property_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_page_id_workspace_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_last_edited_by_id_user_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_row" ADD CONSTRAINT "database_row_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_view" ADD CONSTRAINT "database_view_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "database_organization_id_idx" ON "database" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "database_page_id_idx" ON "database" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "database_deleted_at_idx" ON "database" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "database_cell_row_id_idx" ON "database_cell" USING btree ("row_id");--> statement-breakpoint
CREATE INDEX "database_cell_property_id_idx" ON "database_cell" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "database_cell_row_property_unique" ON "database_cell" USING btree ("row_id","property_id");--> statement-breakpoint
CREATE INDEX "database_property_database_id_idx" ON "database_property" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_property_position_idx" ON "database_property" USING btree ("database_id","position");--> statement-breakpoint
CREATE INDEX "database_row_database_id_idx" ON "database_row" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_row_parent_idx" ON "database_row" USING btree ("database_id","parent_row_id");--> statement-breakpoint
CREATE INDEX "database_row_position_idx" ON "database_row" USING btree ("database_id","position");--> statement-breakpoint
CREATE INDEX "database_row_page_id_idx" ON "database_row" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "database_row_deleted_at_idx" ON "database_row" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "database_view_database_id_idx" ON "database_view" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "database_view_position_idx" ON "database_view" USING btree ("database_id","position");