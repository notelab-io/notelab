import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  activeTeamId: text("active_team_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at"),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  teamId: text("team_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teamMember = pgTable("teamMember", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().default("pageblock"),
    name: text("name").notNull(),
    url: text("url").notNull().default("#"),
    content: jsonb("content"),
    metadata: jsonb("metadata"),
    deletedById: text("deleted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_organization_id_idx").on(table.organizationId),
    index("workspace_type_idx").on(table.type),
    index("workspace_deleted_at_idx").on(table.deletedAt),
  ],
);

export const database = pgTable(
  "database",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config"),
    deletedById: text("deleted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("database_organization_id_idx").on(table.organizationId),
    index("database_page_id_idx").on(table.pageId),
    index("database_deleted_at_idx").on(table.deletedAt),
  ],
);

export const databaseProperty = pgTable(
  "database_property",
  {
    id: text("id").primaryKey(),
    databaseId: text("database_id")
      .notNull()
      .references(() => database.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    config: jsonb("config"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("database_property_database_id_idx").on(table.databaseId),
    index("database_property_position_idx").on(
      table.databaseId,
      table.position,
    ),
  ],
);

export const databaseView = pgTable(
  "database_view",
  {
    id: text("id").primaryKey(),
    databaseId: text("database_id")
      .notNull()
      .references(() => database.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    config: jsonb("config"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("database_view_database_id_idx").on(table.databaseId),
    index("database_view_position_idx").on(table.databaseId, table.position),
  ],
);

export const databaseRow = pgTable(
  "database_row",
  {
    id: text("id").primaryKey(),
    databaseId: text("database_id")
      .notNull()
      .references(() => database.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentRowId: text("parent_row_id"),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastEditedById: text("last_edited_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deletedById: text("deleted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("database_row_database_id_idx").on(table.databaseId),
    index("database_row_parent_idx").on(table.databaseId, table.parentRowId),
    index("database_row_position_idx").on(table.databaseId, table.position),
    index("database_row_page_id_idx").on(table.pageId),
    index("database_row_deleted_at_idx").on(table.deletedAt),
  ],
);

export const databaseCell = pgTable(
  "database_cell",
  {
    id: text("id").primaryKey(),
    rowId: text("row_id")
      .notNull()
      .references(() => databaseRow.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => databaseProperty.id, { onDelete: "cascade" }),
    value: jsonb("value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("database_cell_row_id_idx").on(table.rowId),
    index("database_cell_property_id_idx").on(table.propertyId),
    uniqueIndex("database_cell_row_property_unique").on(
      table.rowId,
      table.propertyId,
    ),
  ],
);

export const rateLimit = pgTable("rateLimit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});
