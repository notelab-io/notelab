import { queryOptions } from "@tanstack/react-query"

import type { ApiFetcher } from "../context"

export type DatabaseRecord = {
  id: string
  organizationId: string
  pageId: string
  name: string
  config?: unknown
  isFavorite?: boolean
  deletedById?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export function getDatabaseEmoji(database: Pick<DatabaseRecord, "config">) {
  if (
    !database.config ||
    typeof database.config !== "object" ||
    Array.isArray(database.config)
  ) {
    return null
  }

  const emoji = (database.config as { emoji?: unknown }).emoji

  return typeof emoji === "string" && emoji.length > 0 ? emoji : null
}

export function getDatabaseCover(database: Pick<DatabaseRecord, "config">) {
  if (
    !database.config ||
    typeof database.config !== "object" ||
    Array.isArray(database.config)
  ) {
    return null
  }

  const cover = (database.config as { cover?: unknown }).cover

  return typeof cover === "string" && cover.length > 0 ? cover : null
}

export type DatabaseProperty = {
  id: string
  databaseId: string
  propertyId: string
  position: number
  width?: number | null
  visible: boolean
  property: WorkspaceProperty
  createdAt: string
  updatedAt: string
}

export type WorkspaceProperty = {
  id: string
  organizationId: string
  name: string
  type: string
  config?: unknown
  deletedById?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type DatabaseView = {
  id: string
  databaseId: string
  type: string
  name: string
  config?: unknown
  position: number
  createdAt: string
  updatedAt: string
}

export type DatabaseRow = {
  id: string
  databaseId: string
  pageId: string
  parentRowId?: string | null
  position: number
  page: {
    createdAt?: string
    id: string
    name: string
    metadata?: unknown
    updatedAt?: string
  }
  createdById?: string | null
  lastEditedById?: string | null
  deletedById?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspacePropertyValue = {
  id: string
  workspaceId: string
  propertyId: string
  value: unknown
  createdAt: string
  updatedAt: string
}

export type DatabaseRowsPagination = {
  hasMore: boolean
  nextCursor: number | null
}

export type DatabasePayload = {
  database: DatabaseRecord
  properties: DatabaseProperty[]
  views: DatabaseView[]
  rows: DatabaseRow[]
  rowCount?: number
  rowsPagination?: DatabaseRowsPagination
  values: WorkspacePropertyValue[]
}

export const databaseQueryKey = (
  databaseId: string | null | undefined,
  options?: { schemaOnly?: boolean },
) =>
  [
    "database",
    databaseId ?? "none",
    options?.schemaOnly ? "schema" : "full",
  ] as const

export const databaseRootQueryKey = () => ["database"] as const

export const databasePayloadRootQueryKey = (
  databaseId: string | null | undefined,
) => ["database", databaseId ?? "none"] as const

export const databaseQueryOptions = (
  apiFetch: ApiFetcher,
  databaseId: string | null | undefined,
  options?: { schemaOnly?: boolean },
) =>
  queryOptions({
    queryKey: databaseQueryKey(databaseId, options),
    enabled: Boolean(databaseId),
    queryFn: async ({ signal }) => {
      if (!databaseId) {
        throw new Error("databaseId is required")
      }

      const params = options?.schemaOnly ? "?schemaOnly=1" : ""

      try {
        return await apiFetch<DatabasePayload>(
          `/databases/${databaseId}${params}`,
          {
            method: "GET",
            signal,
          },
        )
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          error.status === 401
        ) {
          return null
        }

        throw error
      }
    },
  })
