import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../db";
import {
  databaseProperty,
  databaseRow,
  member,
  workspace,
  workspaceProperty,
  workspacePropertyValue,
} from "../db/schema";
import type { AppBindings } from "../types";

export const workspaceRoutes = new Hono<AppBindings>();

const getWorkspace = async (id: string) => {
  const [record] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, id), isNull(workspace.deletedAt)))
    .limit(1);

  return record;
};

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

const requireUser = (c: Context<AppBindings>) => {
  const user = c.get("user");

  if (!user) {
    return null;
  }

  return user;
};

const getWorkspacePropertyPayload = async (
  workspaceId: string,
  organizationId: string,
) => {
  const databaseProperties = await db
    .select({ property: workspaceProperty })
    .from(databaseRow)
    .innerJoin(
      databaseProperty,
      eq(databaseRow.databaseId, databaseProperty.databaseId),
    )
    .innerJoin(
      workspaceProperty,
      eq(databaseProperty.propertyId, workspaceProperty.id),
    )
    .where(
      and(
        eq(databaseRow.pageId, workspaceId),
        eq(workspaceProperty.organizationId, organizationId),
        isNull(databaseRow.deletedAt),
        isNull(workspaceProperty.deletedAt),
      ),
    )
    .orderBy(asc(workspaceProperty.createdAt));

  const properties = Array.from(
    new Map(
      databaseProperties.map(({ property }) => [property.id, property]),
    ).values(),
  );
  const values = await db
    .select()
    .from(workspacePropertyValue)
    .where(eq(workspacePropertyValue.workspaceId, workspaceId));

  return { properties, values };
};

workspaceRoutes.get("/", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const organizationId = c.req.query("organizationId");

  if (!organizationId) {
    return c.json({ error: "organizationId is required" }, 400);
  }

  if (!(await isOrganizationMember(organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const records = await db
    .select()
    .from(workspace)
    .where(
      and(
        eq(workspace.organizationId, organizationId),
        isNull(workspace.deletedAt),
      ),
    );

  return c.json({ workspaces: records });
});

workspaceRoutes.post("/", async (c) => {
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
    type = "pageblock",
    name = "",
    url = "#",
    content = null,
    metadata = null,
  } = body as {
    organizationId?: unknown;
    type?: unknown;
    name?: unknown;
    url?: unknown;
    content?: unknown;
    metadata?: unknown;
  };

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return c.json({ error: "organizationId is required" }, 400);
  }

  if (typeof name !== "string") {
    return c.json({ error: "name must be a string" }, 400);
  }

  if (typeof type !== "string" || typeof url !== "string") {
    return c.json({ error: "type and url must be strings" }, 400);
  }

  if (!(await isOrganizationMember(organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [record] = await db
    .insert(workspace)
    .values({
      id: crypto.randomUUID(),
      organizationId,
      createdById: user.id,
      type,
      name,
      url,
      content,
      metadata,
    })
    .returning();

  return c.json({ workspace: record }, 201);
});

workspaceRoutes.get("/:id", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const record = await getWorkspace(c.req.param("id"));

  if (!record) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  if (!(await isOrganizationMember(record.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json({ workspace: record });
});

workspaceRoutes.get("/:id/properties", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const record = await getWorkspace(c.req.param("id"));

  if (!record) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  if (!(await isOrganizationMember(record.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(
    await getWorkspacePropertyPayload(record.id, record.organizationId),
  );
});

workspaceRoutes.put("/:id/properties/:propertyId/value", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const record = await getWorkspace(c.req.param("id"));

  if (!record) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  if (!(await isOrganizationMember(record.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const propertyId = c.req.param("propertyId");
  const { value = null } = body as { value?: unknown };
  const propertyPayload = await getWorkspacePropertyPayload(
    record.id,
    record.organizationId,
  );
  const property = propertyPayload.properties.find(
    (item) => item.id === propertyId,
  );

  if (!property) {
    return c.json({ error: "Property not found" }, 404);
  }

  await db
    .insert(workspacePropertyValue)
    .values({
      id: crypto.randomUUID(),
      workspaceId: record.id,
      propertyId,
      value,
    })
    .onConflictDoUpdate({
      target: [
        workspacePropertyValue.workspaceId,
        workspacePropertyValue.propertyId,
      ],
      set: {
        value,
        updatedAt: new Date(),
      },
    });

  return c.json(
    await getWorkspacePropertyPayload(record.id, record.organizationId),
  );
});

workspaceRoutes.patch("/:id", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getWorkspace(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const patch = body as {
    type?: unknown;
    name?: unknown;
    url?: unknown;
    content?: unknown;
    metadata?: unknown;
  };
  const values: Partial<typeof workspace.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.type !== undefined) {
    if (typeof patch.type !== "string") {
      return c.json({ error: "type must be a string" }, 400);
    }

    values.type = patch.type;
  }

  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") {
      return c.json({ error: "name must be a string" }, 400);
    }

    values.name = patch.name;
  }

  if (patch.url !== undefined) {
    if (typeof patch.url !== "string") {
      return c.json({ error: "url must be a string" }, 400);
    }

    values.url = patch.url;
  }

  if (patch.content !== undefined) {
    values.content = patch.content;
  }

  if (patch.metadata !== undefined) {
    values.metadata = patch.metadata;
  }

  const [record] = await db
    .update(workspace)
    .set(values)
    .where(eq(workspace.id, existing.id))
    .returning();

  return c.json({ workspace: record });
});

workspaceRoutes.delete("/:id", async (c) => {
  const user = requireUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getWorkspace(c.req.param("id"));

  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  if (!(await isOrganizationMember(existing.organizationId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [record] = await db
    .update(workspace)
    .set({
      deletedAt: new Date(),
      deletedById: user.id,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, existing.id))
    .returning();

  return c.json({ workspace: record });
});
