import type { QueryClient } from "@tanstack/react-query"

import type { ApiFetcher } from "../context"
import { databaseQueryKey, type DatabasePayload } from "./queries"
import {
  applyLocalDatabaseDelta,
  getLocalDatabaseServerVersion,
  setLocalDatabaseServerVersion,
  writeLocalDatabasePayload,
} from "./local-store"
import {
  listPendingDatabaseMutations,
  markDatabaseMutationFailed,
  markDatabaseMutationsCommitted,
  markDatabaseMutationsCommitting,
} from "./outbox"
import type {
  DatabaseBatchMutationResponse,
  DatabaseMutationResponse,
  DatabaseSyncResponse,
  OutboxEntry,
  OutboxMutationType,
} from "./sync-types"
import { isDatabaseMutationResponse } from "./sync-types"

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()
const activeSyncs = new Set<string>()

const batchableTypes = new Set<OutboxMutationType>([
  "reorderProperties",
  "reorderRows",
  "updatePropertyValue",
])

const syncDebounceMs = 400

export function scheduleDatabaseSync(
  databaseId: string,
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  const existing = syncTimers.get(databaseId)

  if (existing) {
    clearTimeout(existing)
  }

  syncTimers.set(
    databaseId,
    setTimeout(() => {
      syncTimers.delete(databaseId)
      void flushDatabaseSync(databaseId, apiFetch, queryClient)
    }, syncDebounceMs),
  )
}

export async function flushDatabaseSync(
  databaseId: string,
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  if (activeSyncs.has(databaseId)) {
    return
  }

  activeSyncs.add(databaseId)

  try {
    const pending = await listPendingDatabaseMutations(databaseId)

    if (pending.length === 0) {
      return
    }

    const batchable = pending.filter((entry) => batchableTypes.has(entry.type))
    const direct = pending.filter((entry) => !batchableTypes.has(entry.type))

    if (batchable.length > 0) {
      await flushBatchableMutations(databaseId, batchable, apiFetch, queryClient)
    }

    for (const entry of direct) {
      await flushDirectMutation(databaseId, entry, apiFetch, queryClient)
    }
  } finally {
    activeSyncs.delete(databaseId)
  }
}

export async function pullDatabaseSync(
  databaseId: string,
  sinceVersion: number,
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  const response = await apiFetch<DatabaseSyncResponse>(
    `/databases/${databaseId}/sync?sinceVersion=${sinceVersion}`,
  )

  let latestVersion = sinceVersion

  for (const mutation of response.mutations) {
    const next = await applyLocalDatabaseDelta(databaseId, mutation.delta, {
      version: mutation.version,
    })

    queryClient.setQueryData(databaseQueryKey(databaseId), next)
    latestVersion = Math.max(latestVersion, mutation.version)
  }

  await setLocalDatabaseServerVersion(databaseId, response.version)

  return latestVersion
}

async function flushBatchableMutations(
  databaseId: string,
  entries: OutboxEntry[],
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  await markDatabaseMutationsCommitting(entries.map((entry) => entry.id))

  try {
    const response = await apiFetch<DatabaseBatchMutationResponse>(
      `/databases/${databaseId}/mutations`,
      {
        body: JSON.stringify({
          mutations: entries.map((entry) => ({
            clientMutationId: entry.clientMutationId,
            payload: entry.payload,
            type: entry.type,
          })),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )

    for (const result of response.results) {
      await applyMutationResponse(databaseId, result, queryClient)
    }

    await setLocalDatabaseServerVersion(databaseId, response.version)
    await markDatabaseMutationsCommitted(entries.map((entry) => entry.id))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync database batch"

    for (const entry of entries) {
      await markDatabaseMutationFailed(entry.id, message)
    }
  }
}

async function flushDirectMutation(
  databaseId: string,
  entry: OutboxEntry,
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  await markDatabaseMutationsCommitting([entry.id])

  try {
    const request = buildDirectMutationRequest(databaseId, entry)
    const response = await apiFetch<unknown>(request.path, {
      body: request.body ? JSON.stringify(request.body) : undefined,
      headers: request.body
        ? { "content-type": "application/json" }
        : undefined,
      method: request.method,
    })

    if (isDatabaseMutationResponse(response)) {
      await applyMutationResponse(databaseId, response, queryClient)
    } else if (response && typeof response === "object" && "database" in response) {
      const payload = response as DatabasePayload

      await writeLocalDatabasePayload(databaseId, payload)
      queryClient.setQueryData(databaseQueryKey(databaseId), payload)
    }

    await markDatabaseMutationsCommitted([entry.id])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync database mutation"

    await markDatabaseMutationFailed(entry.id, message)
  }
}

async function applyMutationResponse(
  databaseId: string,
  response: DatabaseMutationResponse,
  queryClient: QueryClient,
) {
  const next = await applyLocalDatabaseDelta(databaseId, response.delta, {
    version: response.version,
  })

  queryClient.setQueryData(databaseQueryKey(databaseId), next)
  await setLocalDatabaseServerVersion(databaseId, response.version)
}

function buildDirectMutationRequest(databaseId: string, entry: OutboxEntry) {
  const body = {
    ...entry.payload,
    clientMutationId: entry.clientMutationId,
  }

  switch (entry.type) {
    case "addProperty":
      return {
        body,
        method: "POST" as const,
        path: `/databases/${databaseId}/properties`,
      }
    case "addRow":
      return {
        body,
        method: "POST" as const,
        path: `/databases/${databaseId}/rows`,
      }
    case "addView":
      return {
        body,
        method: "POST" as const,
        path: `/databases/${databaseId}/views`,
      }
    case "deleteProperty":
      return {
        body,
        method: "DELETE" as const,
        path: `/databases/${databaseId}/properties/${readPathParam(entry.payload, "databasePropertyId")}`,
      }
    case "duplicateProperty":
      return {
        body,
        method: "POST" as const,
        path: `/databases/${databaseId}/properties/${readPathParam(entry.payload, "databasePropertyId")}/duplicate`,
      }
    case "moveRow":
      return {
        body,
        method: "PATCH" as const,
        path: `/databases/${databaseId}/rows/${readPathParam(entry.payload, "rowId")}/move`,
      }
    case "updateDatabase":
      return {
        body,
        method: "PATCH" as const,
        path: `/databases/${databaseId}`,
      }
    case "updateProperty":
      return {
        body,
        method: "PATCH" as const,
        path: `/databases/${databaseId}/properties/${readPathParam(entry.payload, "databasePropertyId")}`,
      }
    case "updateView":
      return {
        body,
        method: "PATCH" as const,
        path: `/databases/${databaseId}/views/${readPathParam(entry.payload, "databaseViewId")}`,
      }
    default:
      throw new Error(`Unsupported direct mutation type: ${entry.type}`)
  }
}

function readPathParam(payload: Record<string, unknown>, key: string) {
  const value = payload[key]

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`)
  }

  return value
}

export async function getDatabaseSyncBaseline(databaseId: string) {
  return getLocalDatabaseServerVersion(databaseId)
}