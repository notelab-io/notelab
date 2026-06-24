import { useMutation, useQuery } from "@tanstack/react-query"

import { useNotelabFeatures } from "../context"
import {
  applyDatabaseMutationResult,
  createMutationBody,
  hydrateDatabasePayload,
  runLocalDatabaseMutation,
} from "./mutation-local"
import type { DatabaseMutationResponse } from "./sync-types"
import {
  readLocalDatabasePayload,
  writeLocalDatabasePayload,
} from "./local-store"
import {
  databaseQueryKey,
  databaseQueryOptions,
  type DatabasePayload,
} from "./queries"
import { workspacesQueryKey } from "../workspaces/queries"

type DatabaseMutationInput = {
  clientMutationId?: string
}

type CreateDatabaseInput = DatabaseMutationInput & {
  name?: string
  organizationId: string
  pageId: string
}

type UpdateDatabaseInput = DatabaseMutationInput & {
  databaseId: string
  name?: string
  config?: unknown
}

type UpdateDatabaseViewInput = DatabaseMutationInput & {
  config?: unknown
  databaseId: string
  databaseViewId: string
  name?: string
  type?: string
}

type AddDatabaseViewInput = DatabaseMutationInput & {
  config?: unknown
  databaseId: string
  name?: string
  type?: string
}

type DeleteDatabaseViewInput = DatabaseMutationInput & {
  databaseId: string
  databaseViewId: string
}

type AddPropertyInput = DatabaseMutationInput & {
  config?: unknown
  databaseId: string
  name?: string
  position?: number
  type?: string
}

type UpdatePropertyInput = DatabaseMutationInput & {
  databaseId: string
  databasePropertyId: string
  config?: unknown
  name?: string
  type?: string
  visible?: boolean
  width?: number | null
}

type AddRowInput = DatabaseMutationInput & {
  databaseId: string
  pageId?: string
  parentRowId?: string | null
  position?: number
  title?: string
}

type ReorderRowsInput = DatabaseMutationInput & {
  databaseId: string
  rowIds: string[]
}

type MoveRowInput = DatabaseMutationInput & {
  databaseId: string
  groupPropertyId?: string
  groupValue?: unknown
  rowId: string
  rowIds: string[]
}

type UpdatePropertyValueInput = DatabaseMutationInput & {
  databaseId: string
  propertyId: string
  rowId: string
  value: unknown
}

type DeletePropertyInput = DatabaseMutationInput & {
  databaseId: string
  databasePropertyId: string
}

type DuplicatePropertyInput = DatabaseMutationInput & {
  databaseId: string
  databasePropertyId: string
  includeValues?: boolean
}

type SetDatabaseFavoriteInput = {
  databaseId: string
  isFavorite: boolean
}

function createDatabaseQueryOptions(
  apiFetch: ReturnType<typeof useNotelabFeatures>["apiFetch"],
  databaseId: string | null | undefined,
  options?: { schemaOnly?: boolean },
) {
  const base = databaseQueryOptions(apiFetch, databaseId, options)

  return {
    ...base,
    queryFn: async () => {
      if (!databaseId) {
        throw new Error("databaseId is required")
      }

      const local = await readLocalDatabasePayload(databaseId)

      if (local) {
        return local
      }

      const params = options?.schemaOnly ? "?schemaOnly=1" : ""

      try {
        const remote = await apiFetch<DatabasePayload>(
          `/databases/${databaseId}${params}`,
          { method: "GET" },
        )

        if (!remote) {
          return null
        }

        await writeLocalDatabasePayload(databaseId, remote)

        return remote
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
  }
}

export function useDatabase(databaseId: string | null | undefined) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(createDatabaseQueryOptions(apiFetch, databaseId))
}

export function useCreateDatabase() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async (input: CreateDatabaseInput) =>
      apiFetch<DatabasePayload>("/databases", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (payload) => {
      await writeLocalDatabasePayload(payload.database.id, payload)
      queryClient.setQueryData(databaseQueryKey(payload.database.id), payload)
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(payload.database.organizationId),
      })
    },
  })
}

export function useUpdateDatabase() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, clientMutationId, ...patch }: UpdateDatabaseInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: () => ({
          database: {
            id: databaseId,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        }),
        clientMutationId,
        databaseId,
        payload: patch,
        queryClient,
        type: "updateDatabase",
      }),
    onSuccess: async (_result, variables) => {
      const payload = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )

      if (payload) {
        await queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(payload.database.organizationId),
        })
      }
    },
  })
}

export function useUpdateDatabaseView() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databaseViewId,
      clientMutationId,
      ...patch
    }: UpdateDatabaseViewInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: () => ({
          views: [
            {
              id: databaseViewId,
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        clientMutationId,
        databaseId,
        payload: {
          databaseViewId,
          ...patch,
        },
        queryClient,
        type: "updateView",
      }),
  })
}

export function useAddDatabaseView() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddDatabaseViewInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/views`,
        {
          method: "POST",
          body: createMutationBody(input),
        },
      )
      const payload = await applyDatabaseMutationResult(
        databaseId,
        response,
        queryClient,
      )

      if (!payload) {
        throw new Error("Failed to apply database view mutation")
      }

      return payload
    },
  })
}

export function useDeleteDatabaseView() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databaseViewId,
    }: DeleteDatabaseViewInput) =>
      apiFetch<DatabasePayload>(
        `/databases/${databaseId}/views/${databaseViewId}`,
        { method: "DELETE" },
      ),
    onSuccess: async (payload, variables) => {
      await applyDatabaseMutationResult(
        variables.databaseId,
        payload,
        queryClient,
      )
    },
  })
}

export function useAddDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddPropertyInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/properties`,
        {
          method: "POST",
          body: createMutationBody(input),
        },
      )
      const payload = await applyDatabaseMutationResult(
        databaseId,
        response,
        queryClient,
      )

      if (!payload) {
        throw new Error("Failed to apply database property mutation")
      }

      return payload
    },
  })
}

export function useUpdateDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databasePropertyId,
      clientMutationId,
      ...patch
    }: UpdatePropertyInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: (payload) => {
          const property = payload.properties.find(
            (entry) => entry.id === databasePropertyId,
          )

          if (!property) {
            return { properties: [] }
          }

          return {
            properties: [
              {
                ...property,
                ...patch,
                property: {
                  ...property.property,
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.type !== undefined ? { type: patch.type } : {}),
                  ...(patch.config !== undefined ? { config: patch.config } : {}),
                  updatedAt: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              },
            ],
          }
        },
        clientMutationId,
        databaseId,
        payload: {
          databasePropertyId,
          ...patch,
        },
        queryClient,
        type: "updateProperty",
      }),
  })
}

export function useDeleteDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      clientMutationId,
      databaseId,
      databasePropertyId,
    }: DeletePropertyInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: () => ({
          removedPropertyIds: [databasePropertyId],
        }),
        clientMutationId,
        databaseId,
        payload: { databasePropertyId },
        queryClient,
        type: "deleteProperty",
      }),
  })
}

export function useDuplicateDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databasePropertyId,
      includeValues = false,
    }: DuplicatePropertyInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/properties/${databasePropertyId}/duplicate`,
        {
          method: "POST",
          body: createMutationBody({ includeValues }),
        },
      )
      const payload = await applyDatabaseMutationResult(
        databaseId,
        response,
        queryClient,
      )

      if (!payload) {
        throw new Error("Failed to apply duplicate property mutation")
      }

      return payload
    },
  })
}

export function useAddDatabaseRow(organizationId: string | null | undefined) {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddRowInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/rows`,
        {
          method: "POST",
          body: createMutationBody(input),
        },
      )
      const payload = await applyDatabaseMutationResult(
        databaseId,
        response,
        queryClient,
      )

      if (!payload) {
        throw new Error("Failed to apply database row mutation")
      }

      return payload
    },
    onSuccess: async () => {
      if (organizationId) {
        await queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(organizationId),
        })
      }
    },
  })
}

export function useReorderDatabaseRows() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, rowIds, clientMutationId }: ReorderRowsInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: () => ({
          rows: rowIds.map((id, position) => ({
            id,
            position,
          })),
        }),
        clientMutationId,
        databaseId,
        payload: { rowIds },
        queryClient,
        type: "reorderRows",
      }),
  })
}

export function useMoveDatabaseRow() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      rowId,
      rowIds,
      groupPropertyId,
      groupValue,
      clientMutationId,
    }: MoveRowInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: (payload) => {
          const row = payload.rows.find((entry) => entry.id === rowId)
          const now = new Date().toISOString()

          return {
            rows: rowIds.map((id, position) => ({
              id,
              position,
              ...(id === rowId
                ? {
                    lastEditedById: undefined,
                    updatedAt: now,
                  }
                : {}),
            })),
            ...(row && groupPropertyId
              ? {
                  values: [
                    {
                      propertyId: groupPropertyId,
                      updatedAt: now,
                      value: groupValue,
                      workspaceId: row.pageId,
                    },
                  ],
                }
              : {}),
          }
        },
        clientMutationId,
        databaseId,
        payload: {
          groupPropertyId,
          groupValue,
          rowId,
          rowIds,
        },
        queryClient,
        type: "moveRow",
      }),
  })
}

export function useUpdateDatabasePropertyValue() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      propertyId,
      rowId,
      value,
      clientMutationId,
    }: UpdatePropertyValueInput) =>
      runLocalDatabaseMutation({
        apiFetch,
        buildDelta: (payload) => {
          const row = payload.rows.find((entry) => entry.id === rowId)
          const now = new Date().toISOString()

          return {
            rows: [
              {
                id: rowId,
                updatedAt: now,
              },
            ],
            values: [
              {
                propertyId,
                updatedAt: now,
                value,
                workspaceId: row?.pageId ?? "",
              },
            ],
          }
        },
        clientMutationId,
        databaseId,
        payload: {
          propertyId,
          rowId,
          value,
        },
        queryClient,
        type: "updatePropertyValue",
      }),
  })
}

export function useSetDatabaseFavorite() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      isFavorite,
    }: SetDatabaseFavoriteInput) =>
      apiFetch<DatabasePayload>(`/databases/${databaseId}/favorite`, {
        method: isFavorite ? "PUT" : "DELETE",
      }),
    onSuccess: async (payload) => {
      await writeLocalDatabasePayload(payload.database.id, payload)
      queryClient.setQueryData(databaseQueryKey(payload.database.id), payload)
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(payload.database.organizationId),
      })
    },
  })
}

export { hydrateDatabasePayload }