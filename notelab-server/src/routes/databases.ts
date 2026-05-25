import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../db";
import {
  database,
  databaseCell,
  databaseProperty,
  databaseRow,
  databaseView,
  member,
  workspace,
} from "../db/schema";
import type { AppBindings } from "../types";

export const databaseRoutes = new Hono<AppBindings>();

const requireUser = (c: Context<AppBindings>) => c.get("user") ?? null;

const isOrganizationMember = async (
  organizationId: string,
  userId: string,
) => {
  const [record] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1);

  return Boolean(record);
};

const getDatabaseRecord = async (id: string) => {
  const [record] = await db
    .select()
    .from(database)
    .where(and(eq(database.id, id), isNull(database.deletedAt)))
    .limit(1);

  return record;
};

const getDatabasePayload = async (id: string) => {
  const record = await getDatabaseRecord(id);

  if (!record) {
    return null;
  }

  const [properties, views, rows, cells] = await Promise.all([
    db
      .select()
      .from(databaseProperty)
      .where(eq(databaseProperty.databaseId, id))
      .orderBy(asc(databaseProperty.position)),
    db
      .select()
      .from(databaseView)
      .where(eq(databaseView.databaseId, id))
      .orderBy(asc(databaseView.position)),
    db
      .select()
      .from(databaseRow)
      .where(and(eq(databaseRow.databaseId, id), isNull(databaseRow.deletedAt)))
      .orderBy(asc(databaseRow.position)),
    db
      .select()
      .from(databaseCell)
      .innerJoin(databaseRow, eq(databaseCell.rowId, databaseRow.id))
      .where(and(eq(databaseRow.databaseId, id), isNull(databaseRow.deletedAt))),
  ]);

  return {
    database: record,
    properties,
    views,
    rows,
    cells: cells.map(({ database_cell }) => database_cell),
  };
};

databaseRoutes.post("/", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const {
    organizationId,
    pageId,
    name = "New database",
  } = body as {
    organizationId?: unknown;
    pageId?: unknown;
    name?: unknown;
  };

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return c.json({ error: "organizationId is required" }, 400);
  }

  if (typeof pageId !== "string" || pageId.length === 0) {
    return c.json({ error: "pageId is required" }, 400);
  }

  if (typeof name !== "string") {
    return c.json({ error: "name must be a string" }, 400);
  }

  if (!(await isOrganizationMember(organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [page] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(
      and(
        eq(workspace.id, pageId),
        eq(workspace.organizationId, organizationId),
        isNull(workspace.deletedAt),
      ),
    )
    .limit(1);

  if (!page) {
    return c.json({ error: "Page not found" }, 404);
  }

  const databaseId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(database).values({
      id: databaseId,
      organizationId,
      pageId,
      name,
    });
    await tx.insert(databaseView).values({
      id: crypto.randomUUID(),
      databaseId,
      type: "table",
      name: "Table",
      position: 0,
    });
  });

  const payload = await getDatabasePayload(databaseId);

  return c.json(payload, 201);
});

databaseRoutes.get("/:id", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await getDatabasePayload(c.req.param("id"));

  if (!payload) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(payload.database.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(payload);
});

databaseRoutes.patch("/:id", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const patch = body as { name?: unknown; config?: unknown };
  const values: Partial<typeof database.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") {
      return c.json({ error: "name must be a string" }, 400);
    }

    values.name = patch.name;
  }

  if (patch.config !== undefined) {
    values.config = patch.config;
  }

  await db.update(database).set(values).where(eq(database.id, existing.id));

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload);
});

databaseRoutes.post("/:id/properties", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { name = "Property", type = "text" } = body as {
    name?: unknown;
    type?: unknown;
  };

  if (typeof name !== "string" || typeof type !== "string") {
    return c.json({ error: "name and type must be strings" }, 400);
  }

  const properties = await db
    .select({ position: databaseProperty.position })
    .from(databaseProperty)
    .where(eq(databaseProperty.databaseId, existing.id));

  await db.insert(databaseProperty).values({
    id: crypto.randomUUID(),
    databaseId: existing.id,
    name,
    type,
    position: properties.length,
  });

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload, 201);
});

databaseRoutes.patch("/:id/properties/:propertyId", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const patch = body as { name?: unknown; config?: unknown };
  const values: Partial<typeof databaseProperty.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") {
      return c.json({ error: "name must be a string" }, 400);
    }

    values.name = patch.name;
  }

  if (patch.config !== undefined) {
    values.config = patch.config;
  }

  await db
    .update(databaseProperty)
    .set(values)
    .where(
      and(
        eq(databaseProperty.id, c.req.param("propertyId")),
        eq(databaseProperty.databaseId, existing.id),
      ),
    );

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload);
});

databaseRoutes.post("/:id/rows", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { title = "Untitled", parentRowId = null } = body as {
    parentRowId?: unknown;
    title?: unknown;
  };

  if (
    typeof title !== "string" ||
    (parentRowId !== null && typeof parentRowId !== "string")
  ) {
    return c.json({ error: "Invalid row input" }, 400);
  }

  const rows = await db
    .select({ position: databaseRow.position })
    .from(databaseRow)
    .where(eq(databaseRow.databaseId, existing.id));
  const pageId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workspace).values({
      id: pageId,
      organizationId: existing.organizationId,
      createdById: user.id,
      type: "pageblock",
      name: title,
      url: "#",
      content: null,
      metadata: { parentWorkspaceId: existing.pageId },
    });
    await tx.insert(databaseRow).values({
      id: crypto.randomUUID(),
      databaseId: existing.id,
      pageId,
      parentRowId,
      title,
      position: rows.length,
      createdById: user.id,
      lastEditedById: user.id,
    });
  });

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload, 201);
});

databaseRoutes.patch("/:id/rows/reorder", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const { rowIds } = body as { rowIds?: unknown };

  if (
    !Array.isArray(rowIds) ||
    rowIds.some((rowId) => typeof rowId !== "string")
  ) {
    return c.json({ error: "rowIds must be an array of strings" }, 400);
  }

  const rows = await db
    .select({ id: databaseRow.id })
    .from(databaseRow)
    .where(and(eq(databaseRow.databaseId, existing.id), isNull(databaseRow.deletedAt)));
  const existingRowIds = new Set(rows.map((row) => row.id));

  if (
    rowIds.length !== existingRowIds.size ||
    rowIds.some((rowId) => !existingRowIds.has(rowId))
  ) {
    return c.json({ error: "rowIds must include every active database row" }, 400);
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      rowIds.map((rowId, position) =>
        tx
          .update(databaseRow)
          .set({ position, updatedAt: new Date() })
          .where(
            and(eq(databaseRow.id, rowId), eq(databaseRow.databaseId, existing.id)),
          ),
      ),
    );
  });

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload);
});

databaseRoutes.put("/:id/rows/:rowId/cells/:propertyId", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getDatabaseRecord(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Database not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const { value = null } = body as { value?: unknown };
  const rowId = c.req.param("rowId");
  const propertyId = c.req.param("propertyId");

  const [row] = await db
    .select({ id: databaseRow.id })
    .from(databaseRow)
    .where(and(eq(databaseRow.id, rowId), eq(databaseRow.databaseId, existing.id)))
    .limit(1);
  const [property] = await db
    .select({ id: databaseProperty.id })
    .from(databaseProperty)
    .where(
      and(
        eq(databaseProperty.id, propertyId),
        eq(databaseProperty.databaseId, existing.id),
      ),
    )
    .limit(1);

  if (!row || !property) {
    return c.json({ error: "Row or property not found" }, 404);
  }

  await db
    .insert(databaseCell)
    .values({
      id: crypto.randomUUID(),
      rowId,
      propertyId,
      value,
    })
    .onConflictDoUpdate({
      target: [databaseCell.rowId, databaseCell.propertyId],
      set: {
        value,
        updatedAt: new Date(),
      },
    });

  const payload = await getDatabasePayload(existing.id);

  return c.json(payload);
});
