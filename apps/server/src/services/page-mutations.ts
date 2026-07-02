import { and, eq, isNull } from "drizzle-orm";

import { canAccessPage, getMembership } from "../access";
import { db } from "../db";
import { database, page } from "../db/schema";
import { addLinkedItem, readMetadataRecord } from "../item-relationships";
import { insertDatabaseBlockInContent } from "./insert-database-block";
import { ServiceMutationError } from "./database-mutations";

export async function createPageService(input: {
  content?: unknown;
  metadata?: unknown;
  name?: string;
  workspaceId: string;
  type?: string;
  url?: string;
  userId: string;
}) {
  if (!(await getMembership(input.workspaceId, input.userId))) {
    throw new ServiceMutationError("Forbidden", 403);
  }

  if (
    typeof input.metadata === "object" &&
    input.metadata &&
    !Array.isArray(input.metadata) &&
    typeof (input.metadata as { parentItemId?: unknown }).parentItemId ===
      "string" &&
    !(await canAccessPage(
      (input.metadata as { parentItemId: string }).parentItemId,
      input.userId,
      "edit",
    ))
  ) {
    throw new ServiceMutationError("Forbidden", 403);
  }

  const pageId = crypto.randomUUID();

  const [record] = await db
    .insert(page)
    .values({
      id: pageId,
      workspaceId: input.workspaceId,
      createdById: input.userId,
      type: input.type ?? "pageblock",
      name: input.name ?? "",
      url: input.url ?? "#",
      content: input.content ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  return { page: record, pageId: record.id };
}

export async function linkDatabaseInPageService(input: {
  databaseId: string;
  hostPageId: string;
  userId: string;
}) {
  const [host] = await db
    .select()
    .from(page)
    .where(
      and(eq(page.id, input.hostPageId), isNull(page.deletedAt)),
    )
    .limit(1);

  if (!host) {
    throw new ServiceMutationError("Page not found", 404);
  }

  if (!(await canAccessPage(host.id, input.userId, "edit"))) {
    throw new ServiceMutationError("Forbidden", 403);
  }

  const [databaseRecord] = await db
    .select()
    .from(database)
    .where(
      and(
        eq(database.id, input.databaseId),
        eq(database.workspaceId, host.workspaceId),
        isNull(database.deletedAt),
      ),
    )
    .limit(1);

  if (!databaseRecord) {
    throw new ServiceMutationError("Database not found", 404);
  }

  if (!(await canAccessPage(databaseRecord.pageId, input.userId, "view"))) {
    throw new ServiceMutationError("Forbidden", 403);
  }

  if (databaseRecord.pageId === host.id) {
    return {
      action: "setParent" as const,
      hostPageId: host.id,
      databaseId: databaseRecord.id,
    };
  }

  const hostMetadata = addLinkedItem(readMetadataRecord(host.metadata), {
    id: databaseRecord.id,
    kind: "database",
  });

  const [updatedHost] = await db
    .update(page)
    .set({ metadata: hostMetadata, updatedAt: new Date() })
    .where(eq(page.id, host.id))
    .returning();

  return {
    action: "addLink" as const,
    hostPageId: updatedHost?.id ?? host.id,
    databaseId: databaseRecord.id,
  };
}

export async function embedDatabaseInPageService(input: {
  afterHeading?: string;
  databaseId: string;
  userId: string;
  pageId: string;
}) {
  const [existing] = await db
    .select()
    .from(page)
    .where(
      and(eq(page.id, input.pageId), isNull(page.deletedAt)),
    )
    .limit(1);

  if (!existing) {
    throw new ServiceMutationError("Page not found", 404);
  }

  if (!(await canAccessPage(existing.id, input.userId, "edit"))) {
    throw new ServiceMutationError("Forbidden", 403);
  }

  const [databaseRecord] = await db
    .select({ id: database.id, workspaceId: database.workspaceId })
    .from(database)
    .where(
      and(eq(database.id, input.databaseId), isNull(database.deletedAt)),
    )
    .limit(1);

  if (!databaseRecord) {
    throw new ServiceMutationError("Database not found", 404);
  }

  if (databaseRecord.workspaceId !== existing.workspaceId) {
    throw new ServiceMutationError("Database not found", 404);
  }

  const { content, alreadyEmbedded } = insertDatabaseBlockInContent(
    existing.content,
    {
      afterHeading: input.afterHeading,
      databaseId: input.databaseId,
    },
  );

  if (alreadyEmbedded) {
    return {
      alreadyEmbedded: true,
      databaseId: input.databaseId,
      embedMarkdown: `[Database (${input.databaseId})]`,
      pageId: existing.id,
    };
  }

  const [updated] = await db
    .update(page)
    .set({ content, updatedAt: new Date() })
    .where(eq(page.id, existing.id))
    .returning();

  return {
    alreadyEmbedded: false,
    databaseId: input.databaseId,
    embedMarkdown: `[Database (${input.databaseId})]`,
    page: updated,
    pageId: updated?.id ?? existing.id,
  };
}
