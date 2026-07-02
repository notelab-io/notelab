CREATE TABLE "item_visit" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "item_kind" text NOT NULL,
  "item_id" text NOT NULL,
  "last_visited_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX "item_visit_user_id_idx"
  ON "item_visit" ("user_id");

CREATE INDEX "item_visit_organization_id_idx"
  ON "item_visit" ("organization_id");

CREATE INDEX "item_visit_item_idx"
  ON "item_visit" ("item_kind", "item_id");

CREATE UNIQUE INDEX "item_visit_user_item_unique"
  ON "item_visit" ("user_id", "item_kind", "item_id");
