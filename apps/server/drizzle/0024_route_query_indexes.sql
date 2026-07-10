CREATE INDEX IF NOT EXISTS "session_user_id_idx"
  ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_provider_idx"
  ON "account" ("user_id", "provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_workspace_user_idx"
  ON "member" ("workspace_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_user_id_idx"
  ON "member" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_workspace_status_idx"
  ON "invitation" ("workspace_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_email_idx"
  ON "invitation" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_workspace_id_idx"
  ON "team" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_member_user_team_idx"
  ON "teamMember" ("user_id", "team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_member_team_id_idx"
  ON "teamMember" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_workspace_deleted_idx"
  ON "page" ("workspace_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "database_workspace_deleted_idx"
  ON "database" ("workspace_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "database_row_database_deleted_position_idx"
  ON "database_row" ("database_id", "deleted_at", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_property_workspace_deleted_idx"
  ON "page_property" ("workspace_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_asset_page_deleted_idx"
  ON "image_asset" ("page_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_visit_user_workspace_idx"
  ON "item_visit" ("user_id", "workspace_id");
