import assert from "node:assert/strict"
import test from "node:test"

import { applyDatabaseDelta } from "./apply-delta"
import { createTestDatabasePayload } from "./test-helpers"

test("applyDatabaseDelta updates database metadata", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    database: {
      name: "Roadmap",
    },
  })

  assert.equal(next.database.name, "Roadmap")
})

test("applyDatabaseDelta patches an existing cell value", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    values: [
      {
        propertyId: "property-status",
        updatedAt: "2026-06-24T12:00:00.000Z",
        value: "Done",
        pageId: "page-1",
      },
    ],
  })

  assert.equal(next.values.length, 1)
  assert.equal(next.values[0]?.value, "Done")
  assert.equal(next.values[0]?.id, "value-1")
})

test("applyDatabaseDelta inserts a new cell value", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    values: [
      {
        propertyId: "property-name",
        updatedAt: "2026-06-24T12:00:00.000Z",
        value: "Gamma",
        pageId: "page-2",
      },
    ],
  })

  assert.equal(next.values.length, 2)
  assert.deepEqual(
    next.values.find(
      (value) =>
        value.pageId === "page-2" &&
        value.propertyId === "property-name",
    ),
    {
      createdAt: next.values[1]?.createdAt,
      id: next.values[1]?.id,
      propertyId: "property-name",
      updatedAt: "2026-06-24T12:00:00.000Z",
      value: "Gamma",
      pageId: "page-2",
    },
  )
})

test("applyDatabaseDelta reorders rows by position patch", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    rows: [
      { id: "row-2", position: 0 },
      { id: "row-1", position: 1 },
    ],
  })

  assert.deepEqual(
    next.rows.map((row) => row.id),
    ["row-2", "row-1"],
  )
})

test("applyDatabaseDelta inserts a new row with nested page data", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    rows: [
      {
        id: "row-3",
        page: {
          id: "page-3",
          name: "Gamma",
        },
        pageId: "page-3",
        position: 2,
      },
    ],
  })

  assert.equal(next.rows.length, 3)
  assert.equal(next.rows[2]?.page.name, "Gamma")
})

test("applyDatabaseDelta removes properties by id", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    removedPropertyIds: ["column-name"],
  })

  assert.deepEqual(
    next.properties.map((property) => property.id),
    ["column-status"],
  )
})

test("applyDatabaseDelta upserts views and sorts by position", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    views: [
      {
        id: "view-kanban",
        name: "Kanban",
        position: 1,
        type: "kanban",
      },
      {
        id: "view-table",
        name: "Main table",
        position: 0,
      },
    ],
  })

  assert.equal(next.views.length, 2)
  assert.equal(next.views[0]?.id, "view-table")
  assert.equal(next.views[0]?.name, "Main table")
  assert.equal(next.views[1]?.id, "view-kanban")
})

test("applyDatabaseDelta removes views by id", () => {
  const payload = createTestDatabasePayload({
    views: [
      {
        config: {},
        createdAt: "2026-06-01T00:00:00.000Z",
        databaseId: "database-1",
        id: "view-table",
        name: "Table",
        position: 0,
        type: "table",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        config: {},
        createdAt: "2026-06-01T00:00:00.000Z",
        databaseId: "database-1",
        id: "view-kanban",
        name: "Kanban",
        position: 1,
        type: "kanban",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  })
  const next = applyDatabaseDelta(payload, {
    removedViewIds: ["view-table"],
  })

  assert.deepEqual(
    next.views.map((view) => view.id),
    ["view-kanban"],
  )
})

test("applyDatabaseDelta applies combined patches in one pass", () => {
  const payload = createTestDatabasePayload()
  const next = applyDatabaseDelta(payload, {
    properties: [
      {
        id: "column-status",
        position: 1,
      },
      {
        id: "column-name",
        position: 0,
      },
    ],
    rows: [
      {
        id: "row-1",
        lastEditedById: "user-1",
        updatedAt: "2026-06-24T12:00:00.000Z",
      },
    ],
    values: [
      {
        propertyId: "property-status",
        updatedAt: "2026-06-24T12:00:00.000Z",
        value: "In progress",
        pageId: "page-1",
      },
    ],
  })

  assert.deepEqual(
    next.properties.map((property) => property.id),
    ["column-name", "column-status"],
  )
  assert.equal(next.rows[0]?.lastEditedById, "user-1")
  assert.equal(next.values[0]?.value, "In progress")
})