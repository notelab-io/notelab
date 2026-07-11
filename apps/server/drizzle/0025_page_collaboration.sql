CREATE TABLE "page_collaboration_document" (
	"page_id" text PRIMARY KEY NOT NULL,
	"state" bytea NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_collaboration_document" ADD CONSTRAINT "page_collaboration_document_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "page_collaboration_document_updated_idx" ON "page_collaboration_document" USING btree ("updated_at");
