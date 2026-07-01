import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { useNotelabFeatures } from "../context"
import { invalidateDeletedItems } from "../item-action-cache"

import { applyMutationToCache } from "./mutation-cache"
import { setDatabasePayloadQueryData } from "./query-cache"
import {
  databasePayloadRootQueryKey,
  databaseQueryKey,
  databaseQueryOptions,
  type DatabasePayload,
} from "./queries"
import {
  isDatabaseMutationResponse,
  type DatabaseMutationResponse,
} from "./mutation-types"
import {
  applyConfirmedAddedDatabaseRow,
  applyOptimisticAddedDatabaseRow,
  isAddRowResponse,
  type AddRowResponse,
} from "./add-row-cache"
import {
  applyCreatedDatabaseToWorkspaceNav,
} from "./create-database-cache"
import {
  applyDatabaseFavoriteToNav,
  applyNavDelta,
  type NavDelta,
} from "../workspaces/nav-delta"
import {
  workspacesNavRootQueryKey,
  workspacesQueryKey,
  workspacesRootQueryKey,
  type Workspace,
} from "../workspaces/queries"

type CreateDatabaseInput = {
  name?: string
  organizationId: string
  pageId: string
  standalone?: boolean
}

type CreateDatabaseResponse = DatabasePayload & {
  navDelta?: NavDelta
}

type UpdateDatabaseInput = {
  databaseId: string
  name?: string
  config?: unknown
}

type UpdateDatabaseViewInput = {
  config?: unknown
  databaseId: string
  databaseViewId: string
  name?: string
  type?: string
}

type AddDatabaseViewInput = {
  config?: unknown
  databaseId: string
  name?: string
  type?: string
}

type DeleteDatabaseViewInput = {
  databaseId: string
  databaseViewId: string
}

type AddPropertyInput = {
  config?: unknown
  databaseId: string
  name?: string
  position?: number
  type?: string
}

type UpdatePropertyInput = {
  databaseId: string
  databasePropertyId: string
  config?: unknown
  name?: string
  type?: string
  visible?: boolean
  width?: number | null
}

type AddRowInput = {
  databaseId: string
  pageId?: string
  parentRowId?: string | null
  position?: number
  title?: string
}

type ReorderRowsInput = {
  databaseId: string
  rowIds: string[]
}

type MoveRowInput = {
  databaseId: string
  groupPropertyId?: string
  groupValue?: unknown
  rowId: string
  rowIds: string[]
}

type UpdatePropertyValueInput = {
  databaseId: string
  propertyId: string
  rowId: string
  value: unknown
}

type DeletePropertyInput = {
  databaseId: string
  databasePropertyId: string
}

type DuplicatePropertyInput = {
  databaseId: string
  databasePropertyId: string
  includeValues?: boolean
}

type SetDatabaseFavoriteInput = {
  databaseId: string
  isFavorite: boolean
}

async function commitDatabaseMutation(
  queryClient: ReturnType<typeof useNotelabFeatures>["queryClient"],
  databaseId: string,
  response: unknown,
) {
  const payload = applyMutationToCache(queryClient, databaseId, response)

  if (!payload) {
    throw new Error("Failed to apply database mutation")
  }

  return payload
}

function reorderDatabaseRows(
  payload: DatabasePayload | null | undefined,
  rowIds: string[],
) {
  if (!payload) {
    return payload
  }

  const requestedPositions = new Map(
    rowIds.map((rowId, position) => [rowId, position]),
  )
  const rows = payload.rows
    .map((row) => {
      const position = requestedPositions.get(row.id)

      return position === undefined ? row : { ...row, position }
    })
    .sort((left, right) => left.position - right.position)

  return { ...payload, rows }
}

function updateDatabasePropertyValue(
  payload: DatabasePayload | null | undefined,
  input: UpdatePropertyValueInput,
) {
  if (!payload) {
    return payload
  }

  const row = payload.rows.find((candidate) => candidate.id === input.rowId)
  const workspaceId = row?.pageId

  if (!workspaceId) {
    return payload
  }

  const now = new Date().toISOString()
  const existingValue = payload.values.find(
    (value) =>
      value.workspaceId === workspaceId &&
      value.propertyId === input.propertyId,
  )
  const nextValue = {
    createdAt: existingValue?.createdAt ?? now,
    id:
      existingValue?.id ??
      `optimistic-property-value-${crypto.randomUUID()}`,
    propertyId: input.propertyId,
    updatedAt: now,
    value: input.value,
    workspaceId,
  }
  const values = existingValue
    ? payload.values.map((value) =>
        value.id === existingValue.id ? nextValue : value,
      )
    : [...payload.values, nextValue]

  return { ...payload, values }
}

export function useDatabase(
  databaseId: string | null | undefined,
  options?: { schemaOnly?: boolean },
) {
  const { apiFetch } = useNotelabFeatures()
  const query = useQuery(databaseQueryOptions(apiFetch, databaseId, options))
  const hasNextPage = false

  const fetchNextPage = useCallback(async () => {
    return
  }, [])

  return {
    ...query,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: false,
  }
}

export function useCreateDatabase() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async (input: CreateDatabaseInput) => {
      return apiFetch<CreateDatabaseResponse>("/databases", {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    onSuccess: async (payload) => {
      setDatabasePayloadQueryData(queryClient, payload.database.id, payload)
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: workspacesNavRootQueryKey(payload.database.organizationId) },
        (current) =>
          payload.navDelta
            ? applyNavDelta(current, payload.navDelta)
            : applyCreatedDatabaseToWorkspaceNav(current, payload),
      )
    },
  })
}

export function useUpdateDatabase() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, ...patch }: UpdateDatabaseInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: databasePayloadRootQueryKey(variables.databaseId),
      })
      const previous = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )

      queryClient.setQueriesData<DatabasePayload | null>(
        { queryKey: databasePayloadRootQueryKey(variables.databaseId) },
        (current) =>
          current
            ? {
                ...current,
                database: {
                  ...current.database,
                  ...(variables.name !== undefined
                    ? { name: variables.name }
                    : {}),
                  ...(variables.config !== undefined
                    ? { config: variables.config }
                    : {}),
                  updatedAt: new Date().toISOString(),
                },
              }
            : current,
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        setDatabasePayloadQueryData(
          queryClient,
          variables.databaseId,
          context.previous,
        )
      }
    },
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
      ...patch
    }: UpdateDatabaseViewInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/views/${databaseViewId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
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
          body: JSON.stringify(input),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
  })
}

type DeleteDatabaseResult = {
  database: DatabasePayload["database"] | null
  deletedDatabaseIds: string[]
  deletedWorkspaceIds: string[]
}

export function useDeleteDatabase() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async (databaseId: string) =>
      apiFetch<DeleteDatabaseResult>(`/databases/${databaseId}`, {
        method: "DELETE",
      }),
    onSuccess: async (result) =>
      invalidateDeletedItems({
        organizationId: result.database?.organizationId,
        queryClient,
        result,
      }),
  })
}

export function useDeleteDatabaseView() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databaseViewId,
    }: DeleteDatabaseViewInput) => {
      const response = await apiFetch<DatabasePayload>(
        `/databases/${databaseId}/views/${databaseViewId}`,
        { method: "DELETE" },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
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
          body: JSON.stringify(input),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
  })
}

export function useUpdateDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      databaseId,
      databasePropertyId,
      ...patch
    }: UpdatePropertyInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/properties/${databasePropertyId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
  })
}

export function useDeleteDatabaseProperty() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, databasePropertyId }: DeletePropertyInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/properties/${databasePropertyId}`,
        { method: "DELETE" },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
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
          body: JSON.stringify({ includeValues }),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
  })
}

export function useAddDatabaseRow() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ databaseId, ...input }: AddRowInput) => {
      await queryClient.cancelQueries({ queryKey: databaseQueryKey(databaseId) })

      const current = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(databaseId),
      )
      const optimistic = current
        ? applyOptimisticAddedDatabaseRow(current, input)
        : null

      if (optimistic) {
        setDatabasePayloadQueryData(queryClient, databaseId, optimistic.payload)
      }

      let response: AddRowResponse | DatabaseMutationResponse
      let payload: DatabasePayload

      try {
        response = await apiFetch<AddRowResponse | DatabaseMutationResponse>(
          `/databases/${databaseId}/rows`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        )

        if (isAddRowResponse(response)) {
          const latest =
            queryClient.getQueryData<DatabasePayload | null>(
              databaseQueryKey(databaseId),
            ) ??
            optimistic?.payload ??
            current

          if (!latest) {
            throw new Error("Failed to apply database mutation")
          }

          payload = applyConfirmedAddedDatabaseRow(
            latest,
            optimistic
              ? { pageId: optimistic.pageId, rowId: optimistic.rowId }
              : null,
            response,
          )
          setDatabasePayloadQueryData(queryClient, databaseId, payload)
        } else if (isDatabaseMutationResponse(response)) {
          if (current) {
            setDatabasePayloadQueryData(queryClient, databaseId, current)
          }

          payload = await commitDatabaseMutation(queryClient, databaseId, response)
        } else {
          throw new Error("Failed to apply database mutation")
        }
      } catch (error) {
        if (current) {
          setDatabasePayloadQueryData(queryClient, databaseId, current)
        }

        throw error
      }

      if (
        (isAddRowResponse(response) && response.isFavorite) ||
        (!isAddRowResponse(response) && current?.database.isFavorite)
      ) {
        await queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(payload.database.organizationId),
        })
      }

      return payload
    },
  })
}

export function useReorderDatabaseRows() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: databasePayloadRootQueryKey(variables.databaseId),
      })
      const previous = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )

      queryClient.setQueriesData<DatabasePayload | null>(
        { queryKey: databasePayloadRootQueryKey(variables.databaseId) },
        (current) => reorderDatabaseRows(current, variables.rowIds),
      )

      return { previous }
    },
    mutationFn: async ({ databaseId, rowIds }: ReorderRowsInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/rows/reorder`,
        {
          method: "PATCH",
          body: JSON.stringify({ rowIds }),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        setDatabasePayloadQueryData(
          queryClient,
          variables.databaseId,
          context.previous,
        )
      }
    },
  })
}

export function useMoveDatabaseRow() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: databasePayloadRootQueryKey(variables.databaseId),
      })
      const previous = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )

      queryClient.setQueriesData<DatabasePayload | null>(
        { queryKey: databasePayloadRootQueryKey(variables.databaseId) },
        (current) => reorderDatabaseRows(current, variables.rowIds),
      )

      return { previous }
    },
    mutationFn: async ({
      databaseId,
      rowId,
      rowIds,
      groupPropertyId,
      groupValue,
    }: MoveRowInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/rows/${rowId}/move`,
        {
          method: "PATCH",
          body: JSON.stringify({
            groupPropertyId,
            groupValue,
            rowIds,
          }),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        setDatabasePayloadQueryData(
          queryClient,
          variables.databaseId,
          context.previous,
        )
      }
    },
  })
}

export function useUpdateDatabasePropertyValue() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: databasePayloadRootQueryKey(variables.databaseId),
      })
      const previous = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )

      queryClient.setQueriesData<DatabasePayload | null>(
        { queryKey: databasePayloadRootQueryKey(variables.databaseId) },
        (current) => updateDatabasePropertyValue(current, variables),
      )

      return { previous }
    },
    mutationFn: async ({
      databaseId,
      propertyId,
      rowId,
      value,
    }: UpdatePropertyValueInput) => {
      const response = await apiFetch<DatabaseMutationResponse>(
        `/databases/${databaseId}/rows/${rowId}/properties/${propertyId}`,
        {
          method: "PUT",
          body: JSON.stringify({ value }),
        },
      )

      return commitDatabaseMutation(queryClient, databaseId, response)
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        setDatabasePayloadQueryData(
          queryClient,
          variables.databaseId,
          context.previous,
        )
      }
    },
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
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: databasePayloadRootQueryKey(variables.databaseId),
        }),
        queryClient.cancelQueries({ queryKey: workspacesRootQueryKey() }),
      ])
      const previous = queryClient.getQueryData<DatabasePayload | null>(
        databaseQueryKey(variables.databaseId),
      )
      const previousNavQueries = queryClient.getQueriesData<Workspace[]>({
        queryKey: previous
          ? workspacesNavRootQueryKey(previous.database.organizationId)
          : workspacesRootQueryKey(),
      })

      queryClient.setQueriesData<DatabasePayload | null>(
        { queryKey: databasePayloadRootQueryKey(variables.databaseId) },
        (current) =>
          current
            ? {
                ...current,
                database: {
                  ...current.database,
                  isFavorite: variables.isFavorite,
                },
              }
            : current,
      )

      if (previous) {
        queryClient.setQueriesData<Workspace[] | undefined>(
          { queryKey: workspacesNavRootQueryKey(previous.database.organizationId) },
          (current) =>
            applyDatabaseFavoriteToNav(current, {
              ...previous.database,
              isFavorite: variables.isFavorite,
              views: previous.views,
            }),
        )
      }

      return { previous, previousNavQueries }
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        setDatabasePayloadQueryData(
          queryClient,
          variables.databaseId,
          context.previous,
        )
      }

      for (const [queryKey, data] of context?.previousNavQueries ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onSuccess: async (payload) => {
      setDatabasePayloadQueryData(queryClient, payload.database.id, payload)
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: workspacesNavRootQueryKey(payload.database.organizationId) },
        (current) =>
          applyDatabaseFavoriteToNav(current, {
            ...payload.database,
            views: payload.views,
          }),
      )
    },
  })
}
