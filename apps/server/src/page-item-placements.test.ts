import assert from "node:assert/strict";
import test from "node:test";
import { buildNavigationPlacements } from "./page-item-placements";

test("buildNavigationPlacements keeps database row and page linked appearances", () => {
  const placements = buildNavigationPlacements({
    databaseRecords: [
      {
        config: { parentItemId: "parent" },
        id: "database",
        workspaceId: "org",
      },
    ],
    databaseRows: [
      {
        databaseId: "database",
        id: "row",
        pageId: "row-page",
        position: 2,
      },
    ],
    placementRecords: [
      {
        deletedAt: null,
        id: "linked-placement",
        itemId: "row-page",
        itemKind: "page",
        workspaceId: "org",
        parentId: "parent",
        parentKind: "page",
        placementKind: "linked",
        position: 1,
        sourceRowId: null,
      },
    ],
    pageRecords: [
      { id: "parent", metadata: {}, workspaceId: "org" },
      { id: "row-page", metadata: {}, workspaceId: "org" },
    ],
  });

  assert.deepEqual(
    placements.map((placement) => ({
      itemId: placement.itemId,
      parentId: placement.parentId,
      parentKind: placement.parentKind,
      placementKind: placement.placementKind,
    })),
    [
      {
        itemId: "database",
        parentId: "parent",
        parentKind: "page",
        placementKind: "primary",
      },
      {
        itemId: "row-page",
        parentId: "parent",
        parentKind: "page",
        placementKind: "linked",
      },
      {
        itemId: "row-page",
        parentId: "database",
        parentKind: "database",
        placementKind: "database_row",
      },
    ],
  );
});
