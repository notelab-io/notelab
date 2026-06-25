import type { QueryClient } from "@tanstack/react-query"

import { applyDatabaseDelta } from "./apply-delta"
import { setDatabasePayloadQueryData } from "./query-cache"
import { databaseQueryKey, type DatabasePayload } from "./queries"
import { isDatabaseMutationResponse } from "./mutation-types"

export function applyMutationToCache(
  queryClient: QueryClient,
  databaseId: string,
  response: unknown,
): DatabasePayload | null {
  if (isDatabaseMutationResponse(response)) {
    const current = queryClient.getQueryData<DatabasePayload | null>(
      databaseQueryKey(databaseId),
    )

    if (!current) {
      return null
    }

    const next = applyDatabaseDelta(current, response.delta)

    setDatabasePayloadQueryData(queryClient, databaseId, next)

    return next
  }

  if (
    response &&
    typeof response === "object" &&
    "database" in response &&
    typeof (response as DatabasePayload).database?.id === "string"
  ) {
    const payload = response as DatabasePayload

    setDatabasePayloadQueryData(queryClient, databaseId, payload)

    return payload
  }

  return null
}