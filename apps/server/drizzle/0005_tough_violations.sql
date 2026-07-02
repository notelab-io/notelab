ALTER TABLE "user_settings" RENAME TO "workspace_settings";--> statement-breakpoint
ALTER TABLE "workspace_settings" DROP CONSTRAINT "user_settings_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "user_settings_user_id_unique";--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_settings_user_id_unique" ON "workspace_settings" USING btree ("user_id");