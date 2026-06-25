import type { QueryClient } from "@tanstack/react-query"

import type { DatabasePayload } from "./queries"

export function setDatabasePayloadQueryData(
  queryClient: QueryClient,
  databaseId: string,
  payload: DatabasePayload,
) {
  queryClient.setQueriesData<DatabasePayload | null>(
    { queryKey: ["database", databaseId] },
    payload,
  )
}
