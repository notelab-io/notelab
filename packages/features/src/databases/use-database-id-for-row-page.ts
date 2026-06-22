import type { QueryClient } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import { useNotelabFeatures } from "../context"

import { findDatabaseIdForRowPage } from "./row-page-properties"

function subscribeToDatabaseQueries(
  queryClient: QueryClient,
  onStoreChange: () => void,
) {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event?.query.queryKey[0] !== "database") {
      return
    }

    onStoreChange()
  })
}

export function useDatabaseIdForRowPage(
  workspaceId: string | null | undefined,
  explicitDatabaseId?: string | null,
) {
  const { queryClient } = useNotelabFeatures()

  const resolvedFromCache = useSyncExternalStore(
    (onStoreChange) => {
      if (!workspaceId) {
        return () => {}
      }

      return subscribeToDatabaseQueries(queryClient, onStoreChange)
    },
    () => {
      if (!workspaceId) {
        return null
      }

      return findDatabaseIdForRowPage(queryClient, workspaceId)
    },
    () => {
      if (!workspaceId) {
        return null
      }

      return findDatabaseIdForRowPage(queryClient, workspaceId)
    },
  )

  if (explicitDatabaseId) {
    return explicitDatabaseId
  }

  return resolvedFromCache
}