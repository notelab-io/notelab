import { useMutation, useQuery } from "@tanstack/react-query"

import {
  databaseQueryKey,
  databaseQueryOptions,
  type DatabasePayload,
} from "@/features/databases/queries"
import { workspacesQueryKey } from "@/features/workspaces/queries"
import { apiFetch } from "@/lib/api"
import { queryClient } from "@/lib/query-client"

type CreateDatabaseInput = {
  name?: string
  organizationId: string
  pageId: string
}

type UpdateDatabaseInput = {
  databaseId: string
  name?: string
  config?: unknown
}

type AddPropertyInput = {
  databaseId: string
  name?: string
  type?: string
}

type UpdatePropertyInput = {
  databaseId: string
  propertyId: string
  name?: string
  config?: unknown
}

type AddRowInput = {
  databaseId: string
  parentRowId?: string | null
  title?: string
}

type UpdateCellInput = {
  databaseId: string
  propertyId: string
  rowId: string
  value: unknown
}

function setDatabasePayload(payload: DatabasePayload | null) {
  if (!payload) {
    return
  }

  queryClient.setQueryData(databaseQueryKey(payload.database.id), payload)
}

export function useDatabase(databaseId: string | null | undefined) {
  return useQuery(databaseQueryOptions(databaseId))
}

export function useCreateDatabase() {
  return useMutation({
    mutationFn: async (input: CreateDatabaseInput) =>
      apiFetch<DatabasePayload>("/databases", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: setDatabasePayload,
  })
}

export function useUpdateDatabase() {
  return useMutation({
    mutationFn: async ({ databaseId, ...patch }: UpdateDatabaseInput) =>
      apiFetch<DatabasePayload>(`/databases/${databaseId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: setDatabasePayload,
  })
}

export function useAddDatabaseProperty() {
  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddPropertyInput) =>
      apiFetch<DatabasePayload>(`/databases/${databaseId}/properties`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: setDatabasePayload,
  })
}

export function useUpdateDatabaseProperty() {
  return useMutation({
    mutationFn: async ({ databaseId, propertyId, ...patch }: UpdatePropertyInput) =>
      apiFetch<DatabasePayload>(
        `/databases/${databaseId}/properties/${propertyId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        }
      ),
    onSuccess: setDatabasePayload,
  })
}

export function useAddDatabaseRow(organizationId: string | null | undefined) {
  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddRowInput) =>
      apiFetch<DatabasePayload>(`/databases/${databaseId}/rows`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (payload) => {
      setDatabasePayload(payload)
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(organizationId),
      })
    },
  })
}

export function useUpdateDatabaseCell() {
  return useMutation({
    mutationFn: async ({
      databaseId,
      propertyId,
      rowId,
      value,
    }: UpdateCellInput) =>
      apiFetch<DatabasePayload>(
        `/databases/${databaseId}/rows/${rowId}/cells/${propertyId}`,
        {
          method: "PUT",
          body: JSON.stringify({ value }),
        }
      ),
    onSuccess: setDatabasePayload,
  })
}
