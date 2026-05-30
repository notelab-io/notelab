CREATE TABLE "user_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"integration_key" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_organization_id" text,
	"display_name" text,
	"email" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text,
	"scopes" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_integration" ADD CONSTRAINT "user_integration_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integration" ADD CONSTRAINT "user_integration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_integration_user_key_idx" ON "user_integration" USING btree ("organization_id","user_id","integration_key");--> statement-breakpoint
CREATE INDEX "user_integration_organization_idx" ON "user_integration" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_integration_user_idx" ON "user_integration" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_integration_key_idx" ON "user_integration" USING btree ("organization_id","integration_key");--> statement-breakpoint
CREATE INDEX "user_integration_provider_org_idx" ON "user_integration" USING btree ("organization_id","integration_key","provider_organization_id");