import assert from "node:assert/strict"
import test from "node:test"

import {
  appendDatabaseRowPage,
  createInitialPaginatedPayload,
  isDatabasePayloadComplete,
} from "./row-pagination"
import { createTestDatabasePayload } from "./test-helpers"

test("createInitialPaginatedPayload merges schema with the first row page", () => {
  const schema = createTestDatabasePayload({
    rows: [],
    values: [],
  })
  const page = {
    hasMore: true,
    nextCursor: 99,
    rows: createTestDatabasePayload().rows,
    values: createTestDatabasePayload().values,
  }

  const payload = createInitialPaginatedPayload(schema, page)

  assert.equal(payload.rows.length, 2)
  assert.equal(payload.values.length, 1)
  assert.deepEqual(payload.rowsPagination, {
    hasMore: true,
    nextCursor: 99,
  })
})

test("appendDatabaseRowPage appends rows and values without duplicates", () => {
  const payload = createInitialPaginatedPayload(
    createTestDatabasePayload({ rows: [], values: [] }),
    {
      hasMore: true,
      nextCursor: 0,
      rows: [createTestDatabasePayload().rows[0]!],
      values: createTestDatabasePayload().values,
    },
  )

  const next = appendDatabaseRowPage(payload, {
    hasMore: false,
    nextCursor: null,
    rows: [
      {
        ...createTestDatabasePayload().rows[1]!,
        position: 1,
      },
    ],
    values: [
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "value-2",
        propertyId: "property-status",
        updatedAt: "2026-06-01T00:00:00.000Z",
        value: "Done",
        workspaceId: "page-2",
      },
    ],
  })

  assert.equal(next.rows.length, 2)
  assert.equal(next.rows[0]?.id, "row-1")
  assert.equal(next.rows[1]?.id, "row-2")
  assert.equal(next.values.length, 2)
  assert.deepEqual(next.rowsPagination, {
    hasMore: false,
    nextCursor: null,
  })
})

test("isDatabasePayloadComplete treats missing pagination as complete", () => {
  assert.equal(isDatabasePayloadComplete(createTestDatabasePayload()), true)
  assert.equal(
    isDatabasePayloadComplete(
      createTestDatabasePayload({
        rowsPagination: { hasMore: true, nextCursor: 10 },
      }),
    ),
    false,
  )
})