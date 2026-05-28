ALTER TABLE "favorites" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "database_id" text;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_database_id_database_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."database"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_database_id_idx" ON "favorites" USING btree ("database_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_database_unique" ON "favorites" USING btree ("user_id","database_id");