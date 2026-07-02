import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./db";
import { database, databaseRow, page } from "./db/schema";
import { readDatabaseParentItemId } from "./item-relationships";
import { loadWorkspacePageGraph } from "./page-graph";

type SoftDeleteResult = {
  deletedDatabaseIds: string[];
  deletedPageIds: string[];
};

async function softDeleteRecords({
  databaseIds,
  userId,
  pageIds,
}: {
  databaseIds: string[];
  userId: string;
  pageIds: string[];
}) {
  const now = new Date();

  await db.transaction(async (tx) => {
    if (pageIds.length > 0) {
      await tx
        .update(page)
        .set({
          deletedAt: now,
          deletedById: userId,
          updatedAt: now,
        })
        .where(
          and(inArray(page.id, pageIds), isNull(page.deletedAt)),
        );
    }

    if (databaseIds.length > 0) {
      await tx
        .update(database)
        .set({
          deletedAt: now,
          deletedById: userId,
          updatedAt: now,
        })
        .where(
          and(inArray(database.id, databaseIds), isNull(database.deletedAt)),
        );

      await tx
        .update(databaseRow)
        .set({
          deletedAt: now,
          deletedById: userId,
          updatedAt: now,
        })
        .where(
          and(
            inArray(databaseRow.databaseId, databaseIds),
            isNull(databaseRow.deletedAt),
          ),
        );
    }
  });
}

export async function softDeletePageTree({
  workspaceId,
  rootPageId,
  userId,
}: {
  workspaceId: string;
  rootPageId: string;
  userId: string;
}): Promise<SoftDeleteResult> {
  const graph = await loadWorkspacePageGraph(workspaceId);
  const pageIds = new Set(
    graph.getPrimaryNestedPageIds(rootPageId),
  );
  const databaseIds = new Set<string>();

  const databaseRecords = await db
    .select({
      config: database.config,
      id: database.id,
      pageId: database.pageId,
    })
    .from(database)
    .where(
      and(
        eq(database.workspaceId, workspaceId),
        isNull(database.deletedAt),
      ),
    );

  for (const record of databaseRecords) {
    const parentItemId = readDatabaseParentItemId(record.config);

    if (
      !pageIds.has(record.pageId) &&
      (!parentItemId || !pageIds.has(parentItemId))
    ) {
      continue;
    }

    databaseIds.add(record.id);

    for (const pageId of graph.getPrimaryNestedDatabasePageIds(record.id)) {
      pageIds.add(pageId);
    }
  }

  const deletedPageIds = [...pageIds];
  const deletedDatabaseIds = [...databaseIds];

  await softDeleteRecords({
    databaseIds: deletedDatabaseIds,
    userId,
    pageIds: deletedPageIds,
  });

  return { deletedDatabaseIds, deletedPageIds };
}

export async function softDeleteDatabaseTree({
  databaseId,
  workspaceId,
  userId,
}: {
  databaseId: string;
  workspaceId: string;
  userId: string;
}): Promise<SoftDeleteResult> {
  const graph = await loadWorkspacePageGraph(workspaceId);
  const deletedPageIds = graph.getPrimaryNestedDatabasePageIds(databaseId);
  const deletedDatabaseIds = [databaseId];

  await softDeleteRecords({
    databaseIds: deletedDatabaseIds,
    userId,
    pageIds: deletedPageIds,
  });

  return { deletedDatabaseIds, deletedPageIds };
}