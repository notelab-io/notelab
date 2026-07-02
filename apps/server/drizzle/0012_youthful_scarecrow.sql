CREATE TABLE "comment_reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_message_id_comment_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."comment_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reaction_message_idx" ON "comment_reaction" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reaction_message_user_emoji_unique" ON "comment_reaction" USING btree ("message_id","user_id","emoji");