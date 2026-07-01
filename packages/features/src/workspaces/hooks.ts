import { useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { useNotelabFeatures } from "../context"
import { useDatabase } from "../databases/hooks"
import {
  invalidateDeletedItems,
  setWorkspaceDetailCache,
} from "../item-action-cache"
import {
  buildWorkspacePropertiesPayloadFromDatabase,
  findDatabaseIdForRowPage,
  patchDatabaseCacheWorkspacePage,
  patchDatabaseCacheWorkspacePropertyValues,
} from "../databases/row-page-properties"
import { useDatabaseIdForRowPage } from "../databases/use-database-id-for-row-page"
import {
  defaultUserSettings,
  userSettingsQueryKey,
  type UserSettings,
} from "../user-settings/queries"
import type { NavItemKind } from "./item-relationships"
import {
  workspaceQueryKey,
  workspaceQueryOptions,
  getWorkspaceFromDetail,
  readParentItemId,
  workspaceAccessQueryKey,
  workspaceAccessQueryOptions,
  workspaceAccessTargetsQueryOptions,
  workspaceCommentsQueryKey,
  workspaceCommentsQueryOptions,
  workspacePersonAccessTargetsQueryOptions,
  workspacePropertiesQueryKey,
  workspacePropertiesQueryOptions,
  workspaceThreadsQueryKey,
  workspaceThreadsQueryOptions,
  notelabAiWorkspacesQueryKey,
  notelabAiWorkspacesQueryOptions,
  workspacesQueryKey,
  workspacesQueryOptions,
  type WorkspaceDetail,
  type AccessLevel,
  type AccessTargetType,
  type WorkspacesDeletedFilter,
  type Workspace,
  type WorkspaceCommentsPayload,
  type WorkspaceCommentMessage,
  type WorkspaceMetadata,
  type WorkspacePropertiesPayload,
} from "./queries"
import {
  applyWorkspaceFavoriteToNav,
  applyItemVisitToNav,
  applyNavDelta,
  type NavDelta,
} from "./nav-delta"

type CreateWorkspaceInput = {
  content?: unknown
  metadata?: WorkspaceMetadata
  organizationId: string
  name?: string
  emoji?: string
  parentItemId?: string
}

type CreateWorkspaceResponse = {
  navDelta?: NavDelta
  workspace: Workspace
}

type CreatedWorkspaceResult = Workspace & {
  navDelta?: NavDelta
}

type UpdateWorkspaceInput = {
  id: string
  content?: unknown
  name?: string
  metadata?: WorkspaceMetadata
}

type UpdateWorkspacePropertyValueInput = {
  propertyId: string
  value: unknown
  workspaceId: string
}

type CreateWorkspaceCommentInput = {
  body: string
  workspaceId: string
}

type UpdateWorkspaceCommentInput = {
  body: string
  messageId: string
  workspaceId: string
}

type DeleteWorkspaceCommentInput = {
  messageId: string
  workspaceId: string
}

type UpdateWorkspaceCommentReactionInput = {
  emoji: string
  messageId: string
  workspaceId: string
}

type ResolveWorkspaceCommentThreadInput = {
  workspaceId: string
  threadId?: string
}

type UpsertWorkspaceAccessInput = {
  accessLevel: AccessLevel
  targetId: string
  targetType: AccessTargetType
  workspaceId: string
}

type SetWorkspacePublishedInput = {
  isPublished: boolean
  workspaceId: string
}

type SetWorkspaceFavoriteInput = {
  isFavorite: boolean
  workspaceId: string
}

type RecordItemVisitInput = {
  itemId: string
  itemKind: "database" | "workspace"
  organizationId: string
}

export function useWorkspaces(
  organizationId: string | null | undefined,
  options?: { deleted?: WorkspacesDeletedFilter; enabled?: boolean },
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery({
    ...workspacesQueryOptions(apiFetch, organizationId, {
      deleted: options?.deleted,
    }),
    enabled:
      Boolean(organizationId) && (options?.enabled ?? true),
  })
}

export function useNotelabAiWorkspaces(
  organizationId: string | null | undefined,
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(notelabAiWorkspacesQueryOptions(apiFetch, organizationId))
}

type WorkspaceQueryHookOptions = {
  refetchOnMount?: boolean
}

export function useWorkspace(
  workspaceId: string | null | undefined,
  options?: WorkspaceQueryHookOptions,
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery({
    ...workspaceQueryOptions(apiFetch, workspaceId),
    refetchOnMount: options?.refetchOnMount,
    select: (detail) => getWorkspaceFromDetail(detail),
  })
}

export function useWorkspaceAccessLevel(
  workspaceId: string | null | undefined,
  options?: WorkspaceQueryHookOptions,
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery({
    ...workspaceQueryOptions(apiFetch, workspaceId),
    refetchOnMount: options?.refetchOnMount,
    select: (detail) => detail?.accessLevel ?? null,
  })
}

export function useWorkspaceAccess(workspaceId: string | null | undefined) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(workspaceAccessQueryOptions(apiFetch, workspaceId))
}

export function useWorkspaceAccessTargets(
  organizationId: string | null | undefined,
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(workspaceAccessTargetsQueryOptions(apiFetch, organizationId))
}

export function useWorkspacePersonAccessTargets(
  workspaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery({
    ...workspacePersonAccessTargetsQueryOptions(apiFetch, workspaceId),
    enabled:
      Boolean(workspaceId) && (options?.enabled ?? true),
  })
}

type WorkspacePropertiesOptions = {
  databaseId?: string | null
}

export function useWorkspaceProperties(
  workspaceId: string | null | undefined,
  options?: WorkspacePropertiesOptions,
) {
  const { apiFetch } = useNotelabFeatures()
  const resolvedDatabaseId = useDatabaseIdForRowPage(
    workspaceId,
    options?.databaseId,
  )
  const databaseQuery = useDatabase(resolvedDatabaseId)
  const apiQuery = useQuery({
    ...workspacePropertiesQueryOptions(apiFetch, workspaceId),
    enabled: Boolean(workspaceId) && !resolvedDatabaseId,
  })
  const derivedPayload = useMemo(() => {
    if (!resolvedDatabaseId || !databaseQuery.data || !workspaceId) {
      return undefined
    }

    return buildWorkspacePropertiesPayloadFromDatabase(
      databaseQuery.data,
      workspaceId,
    )
  }, [databaseQuery.data, resolvedDatabaseId, workspaceId])

  if (!resolvedDatabaseId) {
    return apiQuery
  }

  return {
    ...databaseQuery,
    data: derivedPayload ?? undefined,
    isLoading: databaseQuery.isLoading,
    isFetching: databaseQuery.isFetching,
    isError: databaseQuery.isError,
    error: databaseQuery.error,
    refetch: databaseQuery.refetch,
  }
}

export function useWorkspaceComments(
  workspaceId: string | null | undefined,
  threadIdOrEnabled?: string | null | boolean,
  enabled = true,
) {
  const { apiFetch } = useNotelabFeatures()

  let threadId: string | null | undefined
  let isEnabled = enabled

  if (typeof threadIdOrEnabled === "boolean") {
    isEnabled = threadIdOrEnabled
    threadId = undefined
  } else if (threadIdOrEnabled !== undefined) {
    threadId = threadIdOrEnabled
  }

  return useQuery(workspaceCommentsQueryOptions(apiFetch, workspaceId, threadId, isEnabled))
}

export function useWorkspaceThreads(
  workspaceId: string | null | undefined,
  enabled = true,
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(workspaceThreadsQueryOptions(apiFetch, workspaceId, enabled))
}

function updateCommentReaction(
  payload: WorkspaceCommentsPayload | undefined,
  messageId: string,
  emoji: string,
  delta: 1 | -1,
) {
  if (!payload) {
    return payload
  }

  return {
    ...payload,
    comments: payload.comments.map((comment) => {
      if (comment.id !== messageId) {
        return comment
      }

      const reactions = [...(comment.reactions ?? [])]
      const index = reactions.findIndex((reaction) => reaction.emoji === emoji)
      const current = index >= 0
        ? reactions[index]
        : { count: 0, emoji, reactedByMe: false }
      const nextCount = Math.max(0, current.count + delta)
      const nextReaction = {
        ...current,
        count: nextCount,
        reactedByMe: delta > 0,
      }

      if (nextCount === 0) {
        if (index >= 0) {
          reactions.splice(index, 1)
        }
      } else if (index >= 0) {
        reactions[index] = nextReaction
      } else {
        reactions.push(nextReaction)
      }

      return { ...comment, reactions }
    }),
  }
}

export function useCreateWorkspace() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      content = null,
      organizationId,
      name = "",
      emoji,
      metadata: inputMetadata,
      parentItemId,
    }: CreateWorkspaceInput) => {
      const userSettings =
        queryClient.getQueryData<UserSettings>(userSettingsQueryKey) ??
        defaultUserSettings
      const metadata: WorkspaceMetadata = {
        embeddedItemsOpenAs: userSettings.embeddedItemsOpenAs,
        fullWidth: Boolean(userSettings.workspaceFullWidth),
        useUserEmbeddedItemsPreference: true,
        useUserFullWidthPreference: true,
        ...(inputMetadata ?? {}),
      }

      if (emoji) {
        metadata.emoji = emoji
      }

      if (parentItemId) {
        metadata.parentItemId = parentItemId
        metadata.parentItemKind = "workspace"
      }

      const result = await apiFetch<CreateWorkspaceResponse>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          name,
          type: "pageblock",
          url: "#",
          content,
          metadata,
        }),
      })

      return {
        ...result.workspace,
        navDelta: result.navDelta,
      } satisfies CreatedWorkspaceResult
    },
    onSuccess: async (workspace) => {
      const { navDelta, ...workspaceRecord } = workspace
      const parentItemId = readParentItemId(workspaceRecord.metadata)
      const parentDetail = parentItemId
        ? queryClient.getQueryData<WorkspaceDetail | null>(
            workspaceQueryKey(parentItemId),
          )
        : null
      const inheritedAccessLevel =
        parentDetail?.accessLevel ?? ("full" as AccessLevel)

      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(workspaceRecord.id),
        (current) => ({
          accessLevel: current?.accessLevel ?? inheritedAccessLevel,
          workspace: {
            ...(current?.workspace ?? {}),
            ...workspaceRecord,
            isFavorite:
              workspaceRecord.isFavorite ?? current?.workspace.isFavorite,
            isTeamspace:
              workspaceRecord.isTeamspace ?? current?.workspace.isTeamspace,
          },
        }),
      )
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: ["workspaces", workspaceRecord.organizationId, "nav"] },
        (current) =>
          applyNavDelta(
            current,
            navDelta ?? { upsertWorkspaces: [workspaceRecord] },
          ),
      )

      if (workspaceRecord.metadata?.notelabai) {
        await queryClient.invalidateQueries({
          queryKey: notelabAiWorkspacesQueryKey(workspaceRecord.organizationId),
        })
      }
    },
  })
}

export function useUpsertWorkspaceAccess() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      accessLevel,
      targetId,
      targetType,
      workspaceId,
    }: UpsertWorkspaceAccessInput) => {
      const result = await apiFetch<{ access: unknown }>(
        `/workspaces/${workspaceId}/access`,
        {
          method: "PUT",
          body: JSON.stringify({ accessLevel, targetId, targetType }),
        },
      )

      return result.access
    },
    onSuccess: async (_access, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceAccessQueryKey(variables.workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKey(variables.workspaceId),
        }),
      ])
    },
  })
}

export function useDeleteWorkspaceAccess() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      ruleId,
      workspaceId,
    }: {
      ruleId: string
      workspaceId: string
    }) =>
      apiFetch<{ access: unknown }>(
        `/workspaces/${workspaceId}/access/${ruleId}`,
        { method: "DELETE" },
      ),
    onSuccess: async (_access, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceAccessQueryKey(variables.workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKey(variables.workspaceId),
        }),
      ])
    },
  })
}

export function useSetWorkspacePublished() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      isPublished,
      workspaceId,
    }: SetWorkspacePublishedInput) => {
      if (isPublished) {
        const result = await apiFetch<{ access: unknown }>(
          `/workspaces/${workspaceId}/access`,
          {
            method: "PUT",
            body: JSON.stringify({
              accessLevel: "view",
              targetId: "*",
              targetType: "public",
            }),
          },
        )

        return result.access
      }

      return apiFetch<{ access: unknown }>(
        `/workspaces/${workspaceId}/access/public`,
        { method: "DELETE" },
      )
    },
    onSuccess: async (_access, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceAccessQueryKey(variables.workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKey(variables.workspaceId),
        }),
      ])
    },
  })
}

type EmbedWorkspaceItemInput = {
  hostWorkspaceId: string
  itemId: string
  kind: NavItemKind
}

export function useEmbedWorkspaceItem() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      hostWorkspaceId,
      itemId,
      kind,
    }: EmbedWorkspaceItemInput) =>
      apiFetch<{ action: string; host: Workspace }>(
        `/workspaces/${hostWorkspaceId}/embed-item`,
        {
          method: "POST",
          body: JSON.stringify({ itemId, kind }),
        },
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(result.host.organizationId),
      })
    },
  })
}

export function useRemoveWorkspaceEmbed() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      hostWorkspaceId,
      itemId,
      kind,
    }: EmbedWorkspaceItemInput) =>
      apiFetch<{ action: string }>(`/workspaces/${hostWorkspaceId}/embed-item`, {
        method: "DELETE",
        body: JSON.stringify({ itemId, kind }),
      }),
    onSuccess: async (_result, variables) => {
      const host = getWorkspaceFromDetail(
        queryClient.getQueryData(workspaceQueryKey(variables.hostWorkspaceId)),
      )

      if (host) {
        await queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(host.organizationId),
        })
      }
    },
  })
}

export function useUpdateWorkspace() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateWorkspaceInput) => {
      const result = await apiFetch<{ workspace: Workspace }>(
        `/workspaces/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      )

      return result.workspace
    },
    onMutate: async (variables) => {
      const previous = queryClient.getQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(variables.id),
      )
      const currentWorkspace = previous?.workspace
      const previousNav = currentWorkspace
        ? queryClient.getQueryData<Workspace[]>(
            workspacesQueryKey(currentWorkspace.organizationId),
          )
        : undefined

      if (!currentWorkspace) {
        return { previous, previousNav }
      }

      const optimisticWorkspace: Workspace = {
        ...currentWorkspace,
        ...(variables.content !== undefined
          ? { content: variables.content }
          : {}),
        ...(variables.metadata !== undefined
          ? { metadata: variables.metadata }
          : {}),
        ...(variables.name !== undefined ? { name: variables.name } : {}),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(variables.id),
        (): WorkspaceDetail => ({
          accessLevel: previous.accessLevel ?? null,
          workspace: optimisticWorkspace,
        }),
      )
      patchDatabaseCacheWorkspacePage(queryClient, optimisticWorkspace)
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: ["workspaces", optimisticWorkspace.organizationId, "nav"] },
        (current) =>
          applyNavDelta(current, { upsertWorkspaces: [optimisticWorkspace] }),
      )

      return { previous, previousNav }
    },
    onError: (_error, variables, context) => {
      if (!context?.previous) {
        return
      }

      queryClient.setQueryData(
        workspaceQueryKey(variables.id),
        context.previous,
      )
      patchDatabaseCacheWorkspacePage(queryClient, context.previous.workspace)

      if (context.previousNav) {
        queryClient.setQueryData(
          workspacesQueryKey(context.previous.workspace.organizationId),
          context.previousNav,
        )
      }
    },
    onSuccess: async (workspace, variables) => {
      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(workspace.id),
        (current) => ({
          accessLevel: current?.accessLevel ?? "full",
          workspace,
        }),
      )
      const rowPageDatabaseIds = patchDatabaseCacheWorkspacePage(
        queryClient,
        workspace,
      )

      const navFieldsChanged =
        variables.name !== undefined || variables.metadata !== undefined

      if (!navFieldsChanged) {
        return
      }

      if (rowPageDatabaseIds.length > 0) {
        return
      }

      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: ["workspaces", workspace.organizationId, "nav"] },
        (current) => applyNavDelta(current, { upsertWorkspaces: [workspace] }),
      )

      if (variables.metadata?.notelabai !== undefined) {
        await queryClient.invalidateQueries({
          queryKey: notelabAiWorkspacesQueryKey(workspace.organizationId),
        })
      }
    },
  })
}

type DeleteWorkspaceResult = {
  deletedDatabaseIds: string[]
  deletedWorkspaceIds: string[]
  workspace: Workspace | null
}

export function useDeleteWorkspace() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async (workspaceId: string) =>
      apiFetch<DeleteWorkspaceResult>(`/workspaces/${workspaceId}`, {
        method: "DELETE",
      }),
    onSuccess: async (result) =>
      invalidateDeletedItems({
        includeNotelabAi: true,
        organizationId: result.workspace?.organizationId,
        queryClient,
        result,
      }),
  })
}

export function useSetWorkspaceFavorite() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      isFavorite,
      workspaceId,
    }: SetWorkspaceFavoriteInput) => {
      const result = await apiFetch<{ workspace: Workspace }>(
        `/workspaces/${workspaceId}/favorite`,
        { method: isFavorite ? "PUT" : "DELETE" },
      )

      return result.workspace
    },
    onSuccess: async (workspace) => {
      setWorkspaceDetailCache(queryClient, workspace)
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: ["workspaces", workspace.organizationId, "nav"] },
        (current) => applyWorkspaceFavoriteToNav(current, workspace),
      )
    },
  })
}

export function useRecordItemVisit() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async (input: RecordItemVisitInput) =>
      apiFetch<{
        itemId: string
        itemKind: RecordItemVisitInput["itemKind"]
        lastVisitedAt: string
      }>("/workspaces/item-visits", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueriesData<Workspace[] | undefined>(
        { queryKey: workspacesQueryKey(variables.organizationId) },
        (current) => applyItemVisitToNav(current, result),
      )

      if (result.itemKind === "workspace") {
        queryClient.setQueryData<WorkspaceDetail | null>(
          workspaceQueryKey(result.itemId),
          (current) =>
            current
              ? {
                  ...current,
                  workspace: {
                    ...current.workspace,
                    lastVisitedAt: result.lastVisitedAt,
                  },
                }
              : current,
        )
      }
    },
  })
}

export function useUpdateWorkspacePropertyValue() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      propertyId,
      value,
      workspaceId,
    }: UpdateWorkspacePropertyValueInput) =>
      apiFetch<WorkspacePropertiesPayload>(
        `/workspaces/${workspaceId}/properties/${propertyId}/value`,
        {
          method: "PUT",
          body: JSON.stringify({ value }),
        },
      ),
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspacePropertiesQueryKey(variables.workspaceId),
        payload,
      )

      const databaseId =
        findDatabaseIdForRowPage(queryClient, variables.workspaceId) ??
        null

      if (databaseId) {
        patchDatabaseCacheWorkspacePropertyValues(
          queryClient,
          databaseId,
          variables.workspaceId,
          payload,
        )
      }
    },
  })
}

export function useCreateWorkspaceComment() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      body,
      workspaceId,
    }: CreateWorkspaceCommentInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      const previous = queryClient.getQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
      )
      const now = new Date().toISOString()
      const thread = previous?.thread ?? {
        createdAt: now,
        id: `optimistic-thread:${crypto.randomUUID()}`,
        lastActivityAt: now,
        organizationId: "",
        updatedAt: now,
        workspaceId: variables.workspaceId,
      }
      const optimisticComment: WorkspaceCommentMessage = {
        author: null,
        authorId: null,
        body: variables.body,
        createdAt: now,
        id: `optimistic-comment:${crypto.randomUUID()}`,
        reactions: [],
        threadId: thread.id,
        updatedAt: now,
      }

      queryClient.setQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
        {
          comments: [...(previous?.comments ?? []), optimisticComment],
          thread,
        },
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        context?.previous,
      )
    },
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        payload,
      )
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useUpdateWorkspaceComment() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      body,
      messageId,
      workspaceId,
    }: UpdateWorkspaceCommentInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/${messageId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ body }),
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      const previous = queryClient.getQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
      )

      queryClient.setQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
        previous
          ? {
              ...previous,
              comments: previous.comments.map((comment) =>
                comment.id === variables.messageId
                  ? {
                      ...comment,
                      body: variables.body,
                      editedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }
                  : comment,
              ),
            }
          : previous,
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        context?.previous,
      )
    },
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        payload,
      )
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useDeleteWorkspaceComment() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ messageId, workspaceId }: DeleteWorkspaceCommentInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/${messageId}`,
        {
          method: "DELETE",
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      const previous = queryClient.getQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
      )

      queryClient.setQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
        previous
          ? {
              ...previous,
              comments: previous.comments.filter(
                (comment) => comment.id !== variables.messageId,
              ),
            }
          : previous,
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        context?.previous,
      )
    },
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        payload,
      )
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useAddWorkspaceCommentReaction() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      emoji,
      messageId,
      workspaceId,
    }: UpdateWorkspaceCommentReactionInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/${messageId}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ emoji }),
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      const previous = queryClient.getQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
      )

      queryClient.setQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
        updateCommentReaction(previous, variables.messageId, variables.emoji, 1),
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        context?.previous,
      )
    },
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        payload,
      )
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useRemoveWorkspaceCommentReaction() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({
      emoji,
      messageId,
      workspaceId,
    }: UpdateWorkspaceCommentReactionInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/${messageId}/reactions`,
        {
          method: "DELETE",
          body: JSON.stringify({ emoji }),
        },
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      const previous = queryClient.getQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
      )

      queryClient.setQueryData<WorkspaceCommentsPayload>(
        workspaceCommentsQueryKey(variables.workspaceId),
        updateCommentReaction(previous, variables.messageId, variables.emoji, -1),
      )

      return { previous }
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        context?.previous,
      )
    },
    onSuccess: (payload, variables) => {
      queryClient.setQueryData(
        workspaceCommentsQueryKey(variables.workspaceId),
        payload,
      )
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useResolveWorkspaceCommentThread() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ workspaceId, threadId }: ResolveWorkspaceCommentThreadInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/thread/resolve`,
        {
          method: "PATCH",
          body: JSON.stringify(threadId ? { threadId } : {}),
        },
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}

export function useUnresolveWorkspaceCommentThread() {
  const { apiFetch, queryClient } = useNotelabFeatures()

  return useMutation({
    mutationFn: async ({ workspaceId, threadId }: ResolveWorkspaceCommentThreadInput) =>
      apiFetch<WorkspaceCommentsPayload>(
        `/workspaces/${workspaceId}/comments/thread/unresolve`,
        {
          method: "PATCH",
          body: JSON.stringify(threadId ? { threadId } : {}),
        },
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceCommentsQueryKey(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}
