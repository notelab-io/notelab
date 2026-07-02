CREATE TABLE "workspace_item_placement" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "parent_kind" text NOT NULL,
  "parent_id" text NOT NULL,
  "item_kind" text NOT NULL,
  "item_id" text NOT NULL,
  "placement_kind" text NOT NULL,
  "source_row_id" text REFERENCES "database_row"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX "workspace_item_placement_org_idx"
  ON "workspace_item_placement" ("organization_id");

CREATE INDEX "workspace_item_placement_parent_idx"
  ON "workspace_item_placement" (
    "organization_id",
    "parent_kind",
    "parent_id",
    "deleted_at"
  );

CREATE INDEX "workspace_item_placement_item_idx"
  ON "workspace_item_placement" (
    "organization_id",
    "item_kind",
    "item_id",
    "deleted_at"
  );

CREATE UNIQUE INDEX "workspace_item_placement_active_unique"
  ON "workspace_item_placement" (
    "organization_id",
    "parent_kind",
    "parent_id",
    "item_kind",
    "item_id",
    "placement_kind",
    coalesce("source_row_id", ''),
    coalesce("deleted_at", 'infinity'::timestamp with time zone)
  );

INSERT INTO "workspace_item_placement" (
  "id",
  "organization_id",
  "parent_kind",
  "parent_id",
  "item_kind",
  "item_id",
  "placement_kind",
  "source_row_id",
  "position",
  "created_at",
  "updated_at"
)
SELECT
  md5('primary:workspace:' || child."id"),
  child."organization_id",
  'workspace',
  child."metadata"->>'parentItemId',
  'workspace',
  child."id",
  'primary',
  NULL,
  0,
  now(),
  now()
FROM "workspace" child
JOIN "workspace" parent
  ON parent."id" = child."metadata"->>'parentItemId'
WHERE child."deleted_at" IS NULL
  AND parent."deleted_at" IS NULL
  AND child."metadata"->>'parentItemId' IS NOT NULL;

INSERT INTO "workspace_item_placement" (
  "id",
  "organization_id",
  "parent_kind",
  "parent_id",
  "item_kind",
  "item_id",
  "placement_kind",
  "source_row_id",
  "position",
  "created_at",
  "updated_at"
)
SELECT
  md5('linked:' || host."id" || ':' || (linked_items.linked_item->>'kind') || ':' || (linked_items.linked_item->>'id')),
  host."organization_id",
  'workspace',
  host."id",
  linked_items.linked_item->>'kind',
  linked_items.linked_item->>'id',
  'linked',
  NULL,
  linked_items.ordinality - 1,
  now(),
  now()
FROM "workspace" host
CROSS JOIN LATERAL jsonb_array_elements(host."metadata"->'linkedItems')
  WITH ORDINALITY AS linked_items(linked_item, ordinality)
WHERE host."deleted_at" IS NULL
  AND jsonb_typeof(host."metadata"->'linkedItems') = 'array'
  AND linked_items.linked_item->>'kind' IN ('workspace', 'database')
  AND linked_items.linked_item->>'id' IS NOT NULL;

INSERT INTO "workspace_item_placement" (
  "id",
  "organization_id",
  "parent_kind",
  "parent_id",
  "item_kind",
  "item_id",
  "placement_kind",
  "source_row_id",
  "position",
  "created_at",
  "updated_at"
)
SELECT
  md5('primary:database:' || database."id"),
  database."organization_id",
  'workspace',
  database."config"->>'parentItemId',
  'database',
  database."id",
  'primary',
  NULL,
  0,
  now(),
  now()
FROM "database"
WHERE database."deleted_at" IS NULL
  AND database."config"->>'parentItemId' IS NOT NULL;

INSERT INTO "workspace_item_placement" (
  "id",
  "organization_id",
  "parent_kind",
  "parent_id",
  "item_kind",
  "item_id",
  "placement_kind",
  "source_row_id",
  "position",
  "created_at",
  "updated_at"
)
SELECT
  md5('database_row:' || database_row."id"),
  database."organization_id",
  'database',
  database_row."database_id",
  'workspace',
  database_row."page_id",
  'database_row',
  database_row."id",
  database_row."position",
  now(),
  now()
FROM "database_row"
JOIN "database" ON database."id" = database_row."database_id"
WHERE database_row."deleted_at" IS NULL
  AND database."deleted_at" IS NULL;
