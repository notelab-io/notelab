CREATE TABLE "database_mutation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"database_id" text NOT NULL,
	"version" integer NOT NULL,
	"client_mutation_id" text,
	"actor_id" text NOT NULL,
	"changed" text[] NOT NULL,
	"delta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"committed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "database_mutation_log" ADD CONSTRAINT "database_mutation_log_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "database_mutation_log" ADD CONSTRAINT "database_mutation_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "database_mutation_log_database_id_idx" ON "database_mutation_log" USING btree ("database_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "database_mutation_log_database_version_unique" ON "database_mutation_log" USING btree ("database_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "database_mutation_log_client_mutation_unique" ON "database_mutation_log" USING btree ("database_id","client_mutation_id") WHERE "client_mutation_id" IS NOT NULL;