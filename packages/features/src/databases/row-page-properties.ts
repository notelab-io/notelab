import type { QueryClient } from "@tanstack/react-query"

import type {
  Workspace,
  WorkspacePropertiesPayload,
} from "../workspaces/queries"

import {
  databaseQueryKey,
  type DatabasePayload,
  type DatabaseProperty,
} from "./queries"
export function findDatabaseIdForRowPage(
  queryClient: QueryClient,
  workspaceId: string,
) {
  return findDatabaseIdsForRowPage(queryClient, workspaceId)[0] ?? null
}

export function findDatabaseIdsForRowPage(
  queryClient: QueryClient,
  workspaceId: string,
) {
  const databaseIds: string[] = []

  for (const [queryKey, data] of queryClient.getQueriesData<DatabasePayload>({
    queryKey: ["database"],
  })) {
    const databaseId = queryKey[1]

    if (typeof databaseId !== "string" || !data) {
      continue
    }

    if (data.rows.some((row) => row.pageId === workspaceId)) {
      databaseIds.push(databaseId)
    }
  }

  return databaseIds
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

export function patchDatabaseCacheWorkspacePropertyValues(
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

export function patchDatabaseCacheWorkspacePage(
  queryClient: QueryClient,
  workspace: Workspace,
) {
  const databaseIds = findDatabaseIdsForRowPage(queryClient, workspace.id)

  for (const databaseId of databaseIds) {
    queryClient.setQueriesData<DatabasePayload>(
      { queryKey: ["database", databaseId] },
      (current) => patchDatabasePayloadWorkspacePage(current, workspace),
    )
  }

  return databaseIds
}

function patchDatabasePayloadWorkspacePage(
  current: DatabasePayload | undefined,
  workspace: Workspace,
) {
  if (!current || !isDatabaseRowPage(current, workspace.id)) {
    return current
  }

  const rows = current.rows.map((row) => {
    if (row.pageId !== workspace.id) {
      return row
    }

    return {
      ...row,
      page: {
        ...row.page,
        id: workspace.id,
        metadata: workspace.metadata,
        name: workspace.name,
        updatedAt: workspace.updatedAt,
      },
    }
  })

  return { ...current, rows }
}