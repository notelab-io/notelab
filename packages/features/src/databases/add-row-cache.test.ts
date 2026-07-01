import assert from "node:assert/strict"
import test from "node:test"

import {
  applyConfirmedAddedDatabaseRow,
  applyOptimisticAddedDatabaseRow,
  isAddRowResponse,
} from "./add-row-cache"
import { createTestDatabasePayload } from "./test-helpers"

test("applyOptimisticAddedDatabaseRow appends an optimistic row", () => {
  const payload = createTestDatabasePayload({ rowCount: 2 })
  const result = applyOptimisticAddedDatabaseRow(payload, {
    title: "Gamma",
  })

  assert.equal(result.payload.rowCount, 3)
  assert.deepEqual(
    result.payload.rows.map((row) => row.position),
    [0, 1, 2],
  )
  assert.equal(result.payload.rows[2]?.id, result.rowId)
  assert.equal(result.payload.rows[2]?.pageId, result.pageId)
  assert.equal(result.payload.rows[2]?.page.name, "Gamma")
})

test("applyOptimisticAddedDatabaseRow inserts in the middle and shifts rows", () => {
  const payload = createTestDatabasePayload()
  const result = applyOptimisticAddedDatabaseRow(payload, {
    pageId: "page-existing",
    position: 1,
    title: "Inserted",
  })

  assert.deepEqual(
    result.payload.rows.map((row) => [row.pageId, row.position]),
    [
      ["page-1", 0],
      ["page-existing", 1],
      ["page-2", 2],
    ],
  )
})

test("applyConfirmedAddedDatabaseRow replaces optimistic ids and adds values", () => {
  const payload = createTestDatabasePayload({ rowCount: 2 })
  const optimistic = applyOptimisticAddedDatabaseRow(payload, {
    position: 1,
    title: "Draft",
  })
  const next = applyConfirmedAddedDatabaseRow(
    optimistic.payload,
    { pageId: optimistic.pageId, rowId: optimistic.rowId },
    {
      createdAt: "2026-06-24T12:00:00.000Z",
      databaseId: "database-1",
      pageId: "page-3",
      parentRowId: null,
      position: 1,
      rowId: "row-3",
      title: "Gamma",
      updatedAt: "2026-06-24T12:00:00.000Z",
      values: [
        {
          createdAt: "2026-06-24T12:00:00.000Z",
          id: "value-2",
          propertyId: "property-status",
          updatedAt: "2026-06-24T12:00:00.000Z",
          value: "Not started",
          workspaceId: "page-3",
        },
      ],
    },
  )

  assert.deepEqual(
    next.rows.map((row) => [row.id, row.pageId, row.position]),
    [
      ["row-1", "page-1", 0],
      ["row-3", "page-3", 1],
      ["row-2", "page-2", 2],
    ],
  )
  assert.equal(next.rowCount, 3)
  assert.equal(next.values.at(-1)?.id, "value-2")
})

test("isAddRowResponse detects compact row create responses", () => {
  assert.equal(
    isAddRowResponse({
      createdAt: "2026-06-24T12:00:00.000Z",
      databaseId: "database-1",
      pageId: "page-3",
      position: 2,
      rowId: "row-3",
      title: "Gamma",
      updatedAt: "2026-06-24T12:00:00.000Z",
    }),
    true,
  )
  assert.equal(isAddRowResponse({ databaseId: "database-1" }), false)
})
