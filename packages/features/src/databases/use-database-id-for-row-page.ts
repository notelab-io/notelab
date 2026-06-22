import { useEffect, useReducer } from "react"

import { useNotelabFeatures } from "../context"

import { findDatabaseIdForRowPage } from "./row-page-properties"

export function useDatabaseIdForRowPage(
  workspaceId: string | null | undefined,
  explicitDatabaseId?: string | null,
) {
  const { queryClient } = useNotelabFeatures()
  const [cacheVersion, bumpCacheVersion] = useReducer(
    (version: number) => version + 1,
    0,
  )

  useEffect(() => {
    if (explicitDatabaseId || !workspaceId) {
      return
    }

    return queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] !== "database") {
        return
      }

      bumpCacheVersion()
    })
  }, [explicitDatabaseId, queryClient, workspaceId])

  if (explicitDatabaseId) {
    return explicitDatabaseId
  }

  if (!workspaceId) {
    return null
  }

  void cacheVersion

  return findDatabaseIdForRowPage(queryClient, workspaceId)
}