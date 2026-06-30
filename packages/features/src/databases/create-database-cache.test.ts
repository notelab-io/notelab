import assert from "node:assert/strict"
import test from "node:test"

import { applyCreatedDatabaseToPageNav } from "./create-database-cache"
import { createTestDatabasePayload } from "./test-helpers"
import { applyNavDelta } from "../pages/nav-delta"
import type { Page } from "../pages/queries"

const createdAt = "2026-06-01T00:00:00.000Z"

function createPage(id: string, databases: Page["databases"] = []) {
  return {
    createdAt,
    databases,
    id,
    name: id,
    navigationPlacements: [],
    workspaceId: "org-1",
    type: "pageblock",
    updatedAt: createdAt,
    url: "#",
  } satisfies Page
}

test("applyCreatedDatabaseToPageNav adds embedded database and placement", () => {
  const payload = createTestDatabasePayload({
    database: {
      config: {
        parentItemId: "page-root",
        parentItemKind: "page",
      },
      id: "database-2",
      name: "New database",
      pageId: "page-root",
    },
    rows: [],
    values: [],
  })
  const next = applyCreatedDatabaseToPageNav(
    [createPage("page-root"), createPage("page-other")],
    payload,
  )

  assert.equal(next?.[0]?.databases?.[0]?.id, "database-2")
  assert.equal(next?.[1]?.databases?.length, 0)
  assert.deepEqual(next?.[0]?.navigationPlacements?.at(-1), {
    id: "legacy:primary:page:page-root:database:database-2:",
    itemId: "database-2",
    itemKind: "database",
    workspaceId: "org-1",
    parentId: "page-root",
    parentKind: "page",
    placementKind: "primary",
    position: 0,
    sourceRowId: null,
  })
  assert.equal(next?.[1]?.navigationPlacements?.at(-1)?.itemId, "database-2")
})

test("applyCreatedDatabaseToPageNav adds standalone database without placement", () => {
  const payload = createTestDatabasePayload({
    database: {
      config: {},
      id: "database-standalone",
      name: "Standalone",
      pageId: "page-root",
    },
    rows: [],
    values: [],
  })
  const next = applyCreatedDatabaseToPageNav(
    [createPage("page-root")],
    payload,
  )

  assert.equal(next?.[0]?.databases?.[0]?.id, "database-standalone")
  assert.deepEqual(next?.[0]?.navigationPlacements, [])
})

test("applyNavDelta upserts created page and placement", () => {
  const next = applyNavDelta([createPage("page-root")], {
    upsertPlacements: [
      {
        id: "legacy:primary:page:page-root:page:page-child:",
        itemId: "page-child",
        itemKind: "page",
        workspaceId: "org-1",
        parentId: "page-root",
        parentKind: "page",
        placementKind: "primary",
        position: 0,
        sourceRowId: null,
      },
    ],
    upsertPages: [createPage("page-child")],
  })

  assert.deepEqual(
    next?.map((page) => page.id),
    ["page-root", "page-child"],
  )
  assert.equal(next?.[0]?.navigationPlacements?.[0]?.itemId, "page-child")
  assert.equal(next?.[1]?.navigationPlacements?.[0]?.itemId, "page-child")
})
