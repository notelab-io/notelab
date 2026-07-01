import assert from "node:assert/strict"
import test from "node:test"

import { applyCreatedDatabaseToWorkspaceNav } from "./create-database-cache"
import { createTestDatabasePayload } from "./test-helpers"
import { applyNavDelta } from "../workspaces/nav-delta"
import type { Workspace } from "../workspaces/queries"

const createdAt = "2026-06-01T00:00:00.000Z"

function createWorkspace(id: string, databases: Workspace["databases"] = []) {
  return {
    createdAt,
    databases,
    id,
    name: id,
    navigationPlacements: [],
    organizationId: "org-1",
    type: "pageblock",
    updatedAt: createdAt,
    url: "#",
  } satisfies Workspace
}

test("applyCreatedDatabaseToWorkspaceNav adds embedded database and placement", () => {
  const payload = createTestDatabasePayload({
    database: {
      config: {
        parentItemId: "page-root",
        parentItemKind: "workspace",
      },
      id: "database-2",
      name: "New database",
      pageId: "page-root",
    },
    rows: [],
    values: [],
  })
  const next = applyCreatedDatabaseToWorkspaceNav(
    [createWorkspace("page-root"), createWorkspace("page-other")],
    payload,
  )

  assert.equal(next?.[0]?.databases?.[0]?.id, "database-2")
  assert.equal(next?.[1]?.databases?.length, 0)
  assert.deepEqual(next?.[0]?.navigationPlacements?.at(-1), {
    id: "legacy:primary:workspace:page-root:database:database-2:",
    itemId: "database-2",
    itemKind: "database",
    organizationId: "org-1",
    parentId: "page-root",
    parentKind: "workspace",
    placementKind: "primary",
    position: 0,
    sourceRowId: null,
  })
  assert.equal(next?.[1]?.navigationPlacements?.at(-1)?.itemId, "database-2")
})

test("applyCreatedDatabaseToWorkspaceNav adds standalone database without placement", () => {
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
  const next = applyCreatedDatabaseToWorkspaceNav(
    [createWorkspace("page-root")],
    payload,
  )

  assert.equal(next?.[0]?.databases?.[0]?.id, "database-standalone")
  assert.deepEqual(next?.[0]?.navigationPlacements, [])
})

test("applyNavDelta upserts created workspace and placement", () => {
  const next = applyNavDelta([createWorkspace("page-root")], {
    upsertPlacements: [
      {
        id: "legacy:primary:workspace:page-root:workspace:page-child:",
        itemId: "page-child",
        itemKind: "workspace",
        organizationId: "org-1",
        parentId: "page-root",
        parentKind: "workspace",
        placementKind: "primary",
        position: 0,
        sourceRowId: null,
      },
    ],
    upsertWorkspaces: [createWorkspace("page-child")],
  })

  assert.deepEqual(
    next?.map((workspace) => workspace.id),
    ["page-root", "page-child"],
  )
  assert.equal(next?.[0]?.navigationPlacements?.[0]?.itemId, "page-child")
  assert.equal(next?.[1]?.navigationPlacements?.[0]?.itemId, "page-child")
})
