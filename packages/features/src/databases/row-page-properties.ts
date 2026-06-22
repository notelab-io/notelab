import type { QueryClient } from "@tanstack/react-query"

import type { WorkspacePropertiesPayload } from "../workspaces/queries"

import {
  databaseQueryKey,
  type DatabasePayload,
  type DatabaseProperty,
} from "./queries"

export function findDatabaseIdForRowPage(
  queryClient: QueryClient,
  workspaceId: string,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<DatabasePayload>({
    queryKey: ["database"],
  })) {
    const databaseId = queryKey[1]

    if (typeof databaseId !== "string" || !data) {
      continue
    }

    if (data.rows.some((row) => row.pageId === workspaceId)) {
      return databaseId
    }
  }

  return null
}

export function isDatabaseRowPage(
  payload: DatabasePayload,
  workspaceId: string,
) {
  return payload.rows.some((row) => row.pageId === workspaceId)
}

export function buildWorkspacePropertiesPayloadFromDatabase(
  payload: DatabasePayload,
  workspaceId: string,
): WorkspacePropertiesPayload | null {
  if (!isDatabaseRowPage(payload, workspaceId)) {
    return null
  }

  const properties = [...payload.properties]
    .sort(
      (left: DatabaseProperty, right: DatabaseProperty) =>
        left.position - right.position,
    )
    .map(({ property }) => property)

  const values = payload.values.filter(
    (value) => value.workspaceId === workspaceId,
  )

  return { properties, values }
}

export function syncDatabaseCacheWorkspacePropertyValues(
  queryClient: QueryClient,
  databaseId: string,
  workspaceId: string,
  workspaceProperties: WorkspacePropertiesPayload,
) {
  queryClient.setQueryData<DatabasePayload>(
    databaseQueryKey(databaseId),
    (current) => {
      if (!current || !isDatabaseRowPage(current, workspaceId)) {
        return current
      }

      const remainingValues = current.values.filter(
        (value) => value.workspaceId !== workspaceId,
      )
      const nextValues = workspaceProperties.values.filter(
        (value) => value.workspaceId === workspaceId,
      )

      return {
        ...current,
        values: [...remainingValues, ...nextValues],
      }
    },
  )
}