import "fake-indexeddb/auto"

import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"
import { QueryClient } from "@tanstack/react-query"

import { resetLocalDatabaseDbForTests } from "./local-db"
import {
  applyLocalDatabaseDelta,
  getLocalDatabaseServerVersion,
  readLocalDatabasePayload,
  writeLocalDatabasePayload,
} from "./local-store"
import {
  countPendingDatabaseMutations,
  enqueueDatabaseMutation,
  listPendingDatabaseMutations,
} from "./outbox"
import { databaseQueryKey } from "./queries"
import {
  flushDatabaseSync,
  pullDatabaseSync,
} from "./sync-worker"
import { isDatabaseMutationResponse } from "./sync-types"
import { createTestDatabasePayload } from "./test-helpers"

const databaseId = "database-1"

beforeEach(async () => {
  await resetLocalDatabaseDbForTests()
})

afterEach(async () => {
  await resetLocalDatabaseDbForTests()
})

test("local store persists and reads database payloads", async () => {
  const payload = createTestDatabasePayload()

  await writeLocalDatabasePayload(databaseId, payload)

  assert.deepEqual(await readLocalDatabasePayload(databaseId), payload)
  assert.equal(await getLocalDatabaseServerVersion(databaseId), 3)
})

test("applyLocalDatabaseDelta updates persisted payload and version", async () => {
  await writeLocalDatabasePayload(databaseId, createTestDatabasePayload())

  const next = await applyLocalDatabaseDelta(
    databaseId,
    {
      database: {
        name: "Updated",
      },
    },
    { version: 4 },
  )

  assert.equal(next.database.name, "Updated")
  assert.equal(next.database.version, 4)
  assert.equal((await readLocalDatabasePayload(databaseId))?.database.name, "Updated")
})

test("outbox coalesces pending cell updates for the same row and property", async () => {
  await enqueueDatabaseMutation({
    clientMutationId: "client-1",
    databaseId,
    payload: {
      propertyId: "property-status",
      rowId: "row-1",
      value: "Draft",
    },
    type: "updatePropertyValue",
  })

  const coalesced = await enqueueDatabaseMutation({
    clientMutationId: "client-2",
    databaseId,
    payload: {
      propertyId: "property-status",
      rowId: "row-1",
      value: "Final",
    },
    type: "updatePropertyValue",
  })

  const pending = await listPendingDatabaseMutations(databaseId)

  assert.equal(pending.length, 1)
  assert.equal(coalesced?.clientMutationId, "client-2")
  assert.equal(pending[0]?.payload.value, "Final")
})

test("flushDatabaseSync batches cell updates through POST /mutations", async () => {
  const payload = createTestDatabasePayload()
  const queryClient = new QueryClient()
  const requests: Array<{ body: unknown; path: string }> = []

  await writeLocalDatabasePayload(databaseId, payload)
  queryClient.setQueryData(databaseQueryKey(databaseId), payload)

  await enqueueDatabaseMutation({
    clientMutationId: "client-a",
    databaseId,
    payload: {
      propertyId: "property-status",
      rowId: "row-1",
      value: "Done",
    },
    type: "updatePropertyValue",
  })
  await enqueueDatabaseMutation({
    clientMutationId: "client-b",
    databaseId,
    payload: {
      propertyId: "property-name",
      rowId: "row-2",
      value: "Renamed",
    },
    type: "updatePropertyValue",
  })

  const apiFetch = async (path: string, init?: RequestInit) => {
    requests.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      path,
    })

    return {
      databaseId,
      results: [
        {
          changed: ["values"],
          clientMutationId: "client-a",
          committedAt: "2026-06-24T12:00:00.000Z",
          databaseId,
          delta: {
            values: [
              {
                propertyId: "property-status",
                updatedAt: "2026-06-24T12:00:00.000Z",
                value: "Done",
                workspaceId: "page-1",
              },
            ],
          },
          mutationId: "mutation-a",
          version: 4,
        },
        {
          changed: ["values"],
          clientMutationId: "client-b",
          committedAt: "2026-06-24T12:00:01.000Z",
          databaseId,
          delta: {
            values: [
              {
                propertyId: "property-name",
                updatedAt: "2026-06-24T12:00:01.000Z",
                value: "Renamed",
                workspaceId: "page-2",
              },
            ],
          },
          mutationId: "mutation-b",
          version: 5,
        },
      ],
      version: 5,
    }
  }

  await flushDatabaseSync(databaseId, apiFetch, queryClient)

  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.path, `/databases/${databaseId}/mutations`)

  const requestBody = requests[0]?.body as {
    mutations: Array<{
      clientMutationId: string
      payload: Record<string, unknown>
      type: string
    }>
  }
  const expectedMutations = [
    {
      clientMutationId: "client-a",
      payload: {
        propertyId: "property-status",
        rowId: "row-1",
        value: "Done",
      },
      type: "updatePropertyValue",
    },
    {
      clientMutationId: "client-b",
      payload: {
        propertyId: "property-name",
        rowId: "row-2",
        value: "Renamed",
      },
      type: "updatePropertyValue",
    },
  ]
  const sortMutations = (
    mutations: typeof expectedMutations,
  ) =>
    [...mutations].sort((left, right) =>
      left.clientMutationId.localeCompare(right.clientMutationId),
    )

  assert.deepEqual(sortMutations(requestBody.mutations), sortMutations(expectedMutations))
  assert.equal(await countPendingDatabaseMutations(databaseId), 0)
  assert.equal(
    queryClient.getQueryData(databaseQueryKey(databaseId))?.database.version,
    5,
  )
  assert.equal(
    queryClient
      .getQueryData(databaseQueryKey(databaseId))
      ?.values.find((value) => value.workspaceId === "page-2")?.value,
    "Renamed",
  )
})

test("flushDatabaseSync sends row reorder mutations as a batch", async () => {
  const payload = createTestDatabasePayload()
  const queryClient = new QueryClient()
  let batchBody: unknown = null

  await writeLocalDatabasePayload(databaseId, payload)
  queryClient.setQueryData(databaseQueryKey(databaseId), payload)

  await enqueueDatabaseMutation({
    clientMutationId: "reorder-1",
    databaseId,
    payload: {
      rowIds: ["row-2", "row-1"],
    },
    type: "reorderRows",
  })

  const apiFetch = async (path: string, init?: RequestInit) => {
    batchBody = init?.body ? JSON.parse(String(init.body)) : null

    return {
      databaseId,
      results: [
        {
          changed: ["rows"],
          clientMutationId: "reorder-1",
          committedAt: "2026-06-24T12:00:00.000Z",
          databaseId,
          delta: {
            rows: [
              { id: "row-2", position: 0 },
              { id: "row-1", position: 1 },
            ],
          },
          mutationId: "mutation-reorder",
          version: 4,
        },
      ],
      version: 4,
    }
  }

  await flushDatabaseSync(databaseId, apiFetch, queryClient)

  assert.deepEqual(batchBody, {
    mutations: [
      {
        clientMutationId: "reorder-1",
        payload: {
          rowIds: ["row-2", "row-1"],
        },
        type: "reorderRows",
      },
    ],
  })
  assert.deepEqual(
    queryClient.getQueryData(databaseQueryKey(databaseId))?.rows.map((row) => row.id),
    ["row-2", "row-1"],
  )
})

test("flushDatabaseSync flushes direct database metadata mutations", async () => {
  const payload = createTestDatabasePayload()
  const queryClient = new QueryClient()
  const requests: Array<{ body: unknown; method?: string; path: string }> = []

  await writeLocalDatabasePayload(databaseId, payload)
  queryClient.setQueryData(databaseQueryKey(databaseId), payload)

  await enqueueDatabaseMutation({
    clientMutationId: "update-db-1",
    databaseId,
    payload: {
      name: "Renamed database",
    },
    type: "updateDatabase",
  })

  const apiFetch = async (path: string, init?: RequestInit) => {
    requests.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      method: init?.method,
      path,
    })

    return {
      changed: ["database"],
      clientMutationId: "update-db-1",
      committedAt: "2026-06-24T12:00:00.000Z",
      databaseId,
      delta: {
        database: {
          id: databaseId,
          name: "Renamed database",
        },
      },
      mutationId: "mutation-db",
      version: 4,
    }
  }

  await flushDatabaseSync(databaseId, apiFetch, queryClient)

  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.method, "PATCH")
  assert.equal(requests[0]?.path, `/databases/${databaseId}`)
  assert.equal(
    queryClient.getQueryData(databaseQueryKey(databaseId))?.database.name,
    "Renamed database",
  )
  assert.equal(await countPendingDatabaseMutations(databaseId), 0)
})

test("pullDatabaseSync applies remote mutation log entries", async () => {
  const payload = createTestDatabasePayload()
  const queryClient = new QueryClient()

  await writeLocalDatabasePayload(databaseId, payload)
  queryClient.setQueryData(databaseQueryKey(databaseId), payload)

  const apiFetch = async (path: string) => {
    assert.equal(path, `/databases/${databaseId}/sync?sinceVersion=3`)

    return {
      databaseId,
      mutations: [
        {
          actorId: "user-2",
          changed: ["values"],
          clientMutationId: "remote-1",
          committedAt: "2026-06-24T12:00:00.000Z",
          delta: {
            values: [
              {
                propertyId: "property-status",
                updatedAt: "2026-06-24T12:00:00.000Z",
                value: "In progress",
                workspaceId: "page-1",
              },
            ],
          },
          id: "mutation-remote",
          version: 4,
        },
      ],
      version: 4,
    }
  }

  const latestVersion = await pullDatabaseSync(
    databaseId,
    3,
    apiFetch,
    queryClient,
  )

  assert.equal(latestVersion, 4)
  assert.equal(
    queryClient
      .getQueryData(databaseQueryKey(databaseId))
      ?.values[0]?.value,
    "In progress",
  )
  assert.equal(await getLocalDatabaseServerVersion(databaseId), 4)
})

test("isDatabaseMutationResponse distinguishes slim mutation responses", () => {
  assert.equal(
    isDatabaseMutationResponse({
      changed: ["values"],
      committedAt: "2026-06-24T12:00:00.000Z",
      databaseId,
      delta: {},
      mutationId: "mutation-1",
      version: 2,
    }),
    true,
  )
  assert.equal(
    isDatabaseMutationResponse({
      database: createTestDatabasePayload().database,
      properties: [],
      rows: [],
      values: [],
      views: [],
    }),
    false,
  )
})