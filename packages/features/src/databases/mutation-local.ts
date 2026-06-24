import type { QueryClient } from "@tanstack/react-query"

import type { ApiFetcher } from "../context"
import {
  applyLocalDatabaseDelta,
  readLocalDatabasePayload,
  writeLocalDatabasePayload,
} from "./local-store"
import { enqueueDatabaseMutation } from "./outbox"
import { databaseQueryKey, type DatabasePayload } from "./queries"
import { fetchPaginatedDatabasePayload } from "./fetch-database-payload"
import { scheduleDatabaseSync } from "./sync-worker"
import type { DatabaseDelta, OutboxMutationType } from "./sync-types"
import {
  createDatabaseClientMutationId,
  rememberDatabaseClientMutationId,
} from "./mutation-tracker"
import { isDatabaseMutationResponse } from "./sync-types"

type LocalMutationInput = {
  apiFetch: ApiFetcher
  buildDelta?: (payload: DatabasePayload) => DatabaseDelta
  clientMutationId?: string
  databaseId: string
  payload: Record<string, unknown>
  queryClient: QueryClient
  type: OutboxMutationType
}

export function createMutationBody(input: Record<string, unknown>) {
  const clientMutationId = createMutationClientId(input)

  return JSON.stringify({
    ...input,
    clientMutationId,
  })
}

export function createMutationClientId(input: Record<string, unknown>) {
  const clientMutationId =
    typeof input.clientMutationId === "string" && input.clientMutationId.length > 0
      ? input.clientMutationId
      : createDatabaseClientMutationId()

  rememberDatabaseClientMutationId(clientMutationId)

  return clientMutationId
}

export async function runLocalDatabaseMutation({
  apiFetch,
  buildDelta,
  clientMutationId: providedClientMutationId,
  databaseId,
  payload,
  queryClient,
  type,
}: LocalMutationInput) {
  const clientMutationId = createMutationClientId({
    clientMutationId: providedClientMutationId,
  })
  const current =
    queryClient.getQueryData<DatabasePayload | null>(
      databaseQueryKey(databaseId),
    ) ?? (await hydrateDatabasePayload(databaseId, apiFetch, queryClient))

  if (!current) {
    throw new Error("Database payload is not available")
  }

  const delta = buildDelta?.(current) ?? {}

  const next = await applyLocalDatabaseDelta(databaseId, delta)

  queryClient.setQueryData(databaseQueryKey(databaseId), next)

  await enqueueDatabaseMutation({
    clientMutationId,
    databaseId,
    payload: {
      ...payload,
      clientMutationId,
    },
    type,
  })

  scheduleDatabaseSync(databaseId, apiFetch, queryClient)

  return {
    clientMutationId,
    databaseId,
    delta,
    version: next.database.version,
  }
}

export async function hydrateDatabasePayload(
  databaseId: string,
  apiFetch: ApiFetcher,
  queryClient: QueryClient,
) {
  const local = await readLocalDatabasePayload(databaseId)

  if (local) {
    queryClient.setQueryData(databaseQueryKey(databaseId), local)

    return local
  }

  const payload = await fetchPaginatedDatabasePayload(apiFetch, databaseId)

  if (!payload) {
    throw new Error("Database payload is not available")
  }

  await writeLocalDatabasePayload(databaseId, payload)
  queryClient.setQueryData(databaseQueryKey(databaseId), payload)

  return payload
}

export async function applyDatabaseMutationResult(
  databaseId: string,
  response: unknown,
  queryClient: QueryClient,
) {
  if (isDatabaseMutationResponse(response)) {
    const next = await applyLocalDatabaseDelta(databaseId, response.delta, {
      version: response.version,
    })

    queryClient.setQueryData(databaseQueryKey(databaseId), next)

    return next
  }

  if (
    response &&
    typeof response === "object" &&
    "database" in response &&
    typeof (response as DatabasePayload).database?.id === "string"
  ) {
    const payload = response as DatabasePayload

    await writeLocalDatabasePayload(databaseId, payload)
    queryClient.setQueryData(databaseQueryKey(databaseId), payload)

    return payload
  }

  return null
}