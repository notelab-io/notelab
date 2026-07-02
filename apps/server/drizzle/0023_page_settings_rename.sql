ALTER TABLE IF EXISTS "workspace_settings" RENAME TO "page_settings";--> statement-breakpoint
ALTER TABLE IF EXISTS "page_settings" RENAME COLUMN "workspace_full_width" TO "page_full_width";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_settings_user_id_unique" RENAME TO "page_settings_user_id_unique";
