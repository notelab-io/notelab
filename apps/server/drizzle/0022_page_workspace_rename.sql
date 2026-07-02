ALTER TABLE "workspace" RENAME TO "page";--> statement-breakpoint
ALTER TABLE "organization" RENAME TO "workspace";--> statement-breakpoint
ALTER TABLE "workspace_access" RENAME TO "page_access";--> statement-breakpoint
ALTER TABLE "workspace_property" RENAME TO "page_property";--> statement-breakpoint
ALTER TABLE "workspace_property_value" RENAME TO "page_property_value";--> statement-breakpoint
ALTER TABLE "workspace_item_placement" RENAME TO "page_item_placement";--> statement-breakpoint
ALTER TABLE "organization_integration" RENAME TO "workspace_integration";--> statement-breakpoint
ALTER TABLE "organization_ai_provider_config" RENAME TO "workspace_ai_provider_config";--> statement-breakpoint

ALTER TABLE "session" RENAME COLUMN "active_organization_id" TO "active_workspace_id";--> statement-breakpoint
ALTER TABLE "member" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "invitation" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "team" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "workspace_integration" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "user_integration" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "user_integration" RENAME COLUMN "provider_organization_id" TO "provider_workspace_id";--> statement-breakpoint
ALTER TABLE "workspace_ai_provider_config" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "page" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "page_access" RENAME COLUMN "workspace_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "page_access" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "image_asset" RENAME COLUMN "workspace_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "image_asset" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "comment_thread" RENAME COLUMN "workspace_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "comment_thread" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "favorites" RENAME COLUMN "workspace_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "item_visit" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "page_property" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "page_property_value" RENAME COLUMN "workspace_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "database" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "ai_chat_thread" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "page_item_placement" RENAME COLUMN "organization_id" TO "workspace_id";--> statement-breakpoint

UPDATE "page_item_placement" SET "parent_kind" = 'page' WHERE "parent_kind" = 'workspace';--> statement-breakpoint
UPDATE "page_item_placement" SET "item_kind" = 'page' WHERE "item_kind" = 'workspace';--> statement-breakpoint
UPDATE "item_visit" SET "item_kind" = 'page' WHERE "item_kind" = 'workspace';--> statement-breakpoint
UPDATE "page"
SET "metadata" = replace(
  replace("metadata"::text, '"kind": "workspace"', '"kind": "page"'),
  '"kind":"workspace"',
  '"kind":"page"'
)::jsonb
WHERE "metadata"::text LIKE '%workspace%';--> statement-breakpoint

ALTER INDEX IF EXISTS "workspace_organization_id_idx" RENAME TO "page_workspace_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_type_idx" RENAME TO "page_type_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_deleted_at_idx" RENAME TO "page_deleted_at_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_access_organization_id_idx" RENAME TO "page_access_workspace_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_access_workspace_id_idx" RENAME TO "page_access_page_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_access_target_idx" RENAME TO "page_access_target_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_access_target_unique" RENAME TO "page_access_target_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_property_organization_id_idx" RENAME TO "page_property_workspace_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_property_deleted_at_idx" RENAME TO "page_property_deleted_at_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_property_value_workspace_id_idx" RENAME TO "page_property_value_page_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_property_value_property_id_idx" RENAME TO "page_property_value_property_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_property_value_unique" RENAME TO "page_property_value_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_item_placement_org_idx" RENAME TO "page_item_placement_workspace_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_item_placement_parent_idx" RENAME TO "page_item_placement_parent_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_item_placement_item_idx" RENAME TO "page_item_placement_item_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "workspace_item_placement_active_unique" RENAME TO "page_item_placement_active_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_integration_account_idx" RENAME TO "workspace_integration_account_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_integration_org_idx" RENAME TO "workspace_integration_workspace_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_integration_key_idx" RENAME TO "workspace_integration_key_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_integration_status_idx" RENAME TO "workspace_integration_status_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_ai_provider_config_provider_idx" RENAME TO "workspace_ai_provider_config_provider_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "organization_ai_provider_config_org_idx" RENAME TO "workspace_ai_provider_config_workspace_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "user_integration_provider_org_idx" RENAME TO "user_integration_provider_workspace_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "database_organization_id_idx" RENAME TO "database_workspace_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "favorites_workspace_id_idx" RENAME TO "favorites_page_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "favorites_user_workspace_unique" RENAME TO "favorites_user_page_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "image_asset_workspace_idx" RENAME TO "image_asset_page_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "image_asset_organization_idx" RENAME TO "image_asset_workspace_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "comment_thread_workspace_deleted_idx" RENAME TO "comment_thread_page_deleted_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "comment_thread_organization_workspace_idx" RENAME TO "comment_thread_workspace_page_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "comment_thread_workspace_state_activity_idx" RENAME TO "comment_thread_page_state_activity_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "item_visit_organization_id_idx" RENAME TO "item_visit_workspace_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "ai_chat_thread_org_user_activity_idx" RENAME TO "ai_chat_thread_workspace_user_activity_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "ai_chat_thread_org_user_archived_activity_idx" RENAME TO "ai_chat_thread_workspace_user_archived_activity_idx";
