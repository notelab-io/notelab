CREATE TABLE "image_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"database_id" text,
	"created_by_id" text,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"uploaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "image_asset_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "image_asset_organization_idx" ON "image_asset" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "image_asset_workspace_idx" ON "image_asset" USING btree ("workspace_id");
