import { and, eq, isNull } from "drizzle-orm";
import { pageItemPlacement } from "./db/schema";
import {
  readDatabaseParentItemId,
  readLinkedItems,
  readParentItemId,
  type ItemRef,
  type NavItemKind,
} from "./item-relationships";

export type PagePlacementKind = "primary" | "linked" | "database_row";

export type PageItemPlacementPayload = {
  id: string;
  workspaceId: string;
  parentKind: NavItemKind;
  parentId: string;
  itemKind: NavItemKind;
  itemId: string;
  placementKind: PagePlacementKind;
  sourceRowId?: string | null;
  position: number;
};

type PlacementRecord = {
  deletedAt?: Date | null;
  id: string;
  workspaceId: string;
  parentKind: string;
  parentId: string;
  itemKind: string;
  itemId: string;
  placementKind: string;
  sourceRowId?: string | null;
  position: number;
};

type PageRecord = {
  id: string;
  workspaceId: string;
  metadata: unknown;
};

type DatabaseRecord = {
  config: unknown;
  id: string;
  workspaceId: string;
};

type DatabaseRowRecord = {
  databaseId: string;
  id: string;
  pageId: string;
  position: number;
};

type PlacementExecutor = {
  insert: (table: typeof pageItemPlacement) => any;
  update: (table: typeof pageItemPlacement) => any;
};

export function buildNavigationPlacements({
  databaseRecords,
  databaseRows,
  placementRecords,
  pageRecords,
}: {
  databaseRecords: DatabaseRecord[];
  databaseRows: DatabaseRowRecord[];
  placementRecords: PlacementRecord[];
  pageRecords: PageRecord[];
}): PageItemPlacementPayload[] {
  const placements = new Map<string, PageItemPlacementPayload>();
  const databaseRowPageIds = new Set(databaseRows.map((row) => row.pageId));

  for (const placement of placementRecords) {
    if (placement.deletedAt) {
      continue;
    }

    if (
      isNavItemKind(placement.parentKind) &&
      isNavItemKind(placement.itemKind) &&
      isPlacementKind(placement.placementKind)
    ) {
      addPlacement(placements, {
        ...placement,
        parentKind: placement.parentKind,
        itemKind: placement.itemKind,
        placementKind: placement.placementKind,
      });
    }
  }

  for (const record of pageRecords) {
    const parentItemId = readParentItemId(record.metadata);

    if (parentItemId && !databaseRowPageIds.has(record.id)) {
      addPlacement(placements, {
        id: legacyPlacementId("primary", "page", parentItemId, "page", record.id),
        workspaceId: record.workspaceId,
        parentKind: "page",
        parentId: parentItemId,
        itemKind: "page",
        itemId: record.id,
        placementKind: "primary",
        sourceRowId: null,
        position: 0,
      });
    }

    readLinkedItems(record.metadata).forEach((item, position) => {
      addPlacement(placements, {
        id: legacyPlacementId("linked", "page", record.id, item.kind, item.id),
        workspaceId: record.workspaceId,
        parentKind: "page",
        parentId: record.id,
        itemKind: item.kind,
        itemId: item.id,
        placementKind: "linked",
        sourceRowId: null,
        position,
      });
    });
  }

  for (const record of databaseRecords) {
    const parentItemId = readDatabaseParentItemId(record.config);

    if (!parentItemId) {
      continue;
    }

    addPlacement(placements, {
      id: legacyPlacementId("primary", "page", parentItemId, "database", record.id),
      workspaceId: record.workspaceId,
      parentKind: "page",
      parentId: parentItemId,
      itemKind: "database",
      itemId: record.id,
      placementKind: "primary",
      sourceRowId: null,
      position: 0,
    });
  }

  const workspaceIdByDatabaseId = new Map(
    databaseRecords.map((record) => [record.id, record.workspaceId]),
  );

  for (const row of databaseRows) {
    const workspaceId = workspaceIdByDatabaseId.get(row.databaseId);

    if (!workspaceId) {
      continue;
    }

    addPlacement(placements, {
      id: legacyPlacementId(
        "database_row",
        "database",
        row.databaseId,
        "page",
        row.pageId,
        row.id,
      ),
      workspaceId,
      parentKind: "database",
      parentId: row.databaseId,
      itemKind: "page",
      itemId: row.pageId,
      placementKind: "database_row",
      sourceRowId: row.id,
      position: row.position,
    });
  }

  return [...placements.values()].sort((first, second) => {
    if (first.position !== second.position) {
      return first.position - second.position;
    }

    return first.id.localeCompare(second.id);
  });
}

export async function upsertPageItemPlacement(
  tx: PlacementExecutor,
  input: Omit<PageItemPlacementPayload, "id" | "position"> & {
    id?: string;
    position?: number;
  },
) {
  const now = new Date();

  await tx
    .insert(pageItemPlacement)
    .values({
      id: input.id ?? crypto.randomUUID(),
      workspaceId: input.workspaceId,
      parentKind: input.parentKind,
      parentId: input.parentId,
      itemKind: input.itemKind,
      itemId: input.itemId,
      placementKind: input.placementKind,
      sourceRowId: input.sourceRowId ?? null,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

export async function softDeletePageItemPlacement(
  tx: PlacementExecutor,
  input: {
    item: ItemRef;
    workspaceId: string;
    parentId: string;
    parentKind: NavItemKind;
  },
) {
  await tx
    .update(pageItemPlacement)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pageItemPlacement.workspaceId, input.workspaceId),
        eq(pageItemPlacement.parentKind, input.parentKind),
        eq(pageItemPlacement.parentId, input.parentId),
        eq(pageItemPlacement.itemKind, input.item.kind),
        eq(pageItemPlacement.itemId, input.item.id),
        isNull(pageItemPlacement.deletedAt),
      ),
    );
}

function addPlacement(
  placements: Map<string, PageItemPlacementPayload>,
  placement: PageItemPlacementPayload,
) {
  const key = [
    placement.parentKind,
    placement.parentId,
    placement.itemKind,
    placement.itemId,
    placement.placementKind,
    placement.sourceRowId ?? "",
  ].join(":");

  if (!placements.has(key)) {
    placements.set(key, placement);
  }
}

function legacyPlacementId(
  placementKind: PagePlacementKind,
  parentKind: NavItemKind,
  parentId: string,
  itemKind: NavItemKind,
  itemId: string,
  sourceRowId = "",
) {
  return `legacy:${placementKind}:${parentKind}:${parentId}:${itemKind}:${itemId}:${sourceRowId}`;
}

function isNavItemKind(value: string): value is NavItemKind {
  return value === "page" || value === "database";
}

function isPlacementKind(value: string): value is PagePlacementKind {
  return value === "primary" || value === "linked" || value === "database_row";
}
