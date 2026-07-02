DROP TABLE IF EXISTS "database_mutation_log";
--> statement-breakpoint
ALTER TABLE "database" DROP COLUMN IF EXISTS "version";