import { useMutation, useQuery } from "@tanstack/react-query"

import { useNotelabFeatures } from "../context"
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
  type Workspace,
  type WorkspaceCommentsPayload,
  type WorkspaceMetadata,
  type WorkspacePropertiesPayload,
} from "./queries"

type CreateWorkspaceInput = {
  content?: unknown
  metadata?: WorkspaceMetadata
  organizationId: string
  name?: string
  emoji?: string
  parentItemId?: string
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

export function useWorkspaces(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery({
    ...workspacesQueryOptions(apiFetch, organizationId),
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

export function useWorkspaceProperties(workspaceId: string | null | undefined) {
  const { apiFetch } = useNotelabFeatures()

  return useQuery(workspacePropertiesQueryOptions(apiFetch, workspaceId))
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
        fullWidth: Boolean(userSettings.workspaceFullWidth),
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

      const result = await apiFetch<{ workspace: Workspace }>("/workspaces", {
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

      return result.workspace
    },
    onSuccess: async (workspace) => {
      const parentItemId = readParentItemId(workspace.metadata)
      const parentDetail = parentItemId
        ? queryClient.getQueryData<WorkspaceDetail | null>(
            workspaceQueryKey(parentItemId),
          )
        : null
      const inheritedAccessLevel =
        parentDetail?.accessLevel ?? ("full" as AccessLevel)

      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(workspace.id),
        (current) => ({
          accessLevel: current?.accessLevel ?? inheritedAccessLevel,
          workspace: {
            ...(current?.workspace ?? {}),
            ...workspace,
            isFavorite: workspace.isFavorite ?? current?.workspace.isFavorite,
            isTeamspace: workspace.isTeamspace ?? current?.workspace.isTeamspace,
          },
        }),
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(workspace.organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: notelabAiWorkspacesQueryKey(workspace.organizationId),
        }),
      ])
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
    onSuccess: async (workspace, variables) => {
      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(workspace.id),
        (current) => ({
          accessLevel: current?.accessLevel ?? null,
          workspace,
        }),
      )

      const navFieldsChanged =
        variables.name !== undefined || variables.metadata !== undefined

      if (!navFieldsChanged) {
        return
      }

      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(workspace.organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: notelabAiWorkspacesQueryKey(workspace.organizationId),
        }),
        queryClient.invalidateQueries({ queryKey: ["database"] }),
      ]

      await Promise.all(invalidations)
    },
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
      queryClient.setQueryData<WorkspaceDetail | null>(
        workspaceQueryKey(workspace.id),
        (current) => ({
          accessLevel: current?.accessLevel ?? null,
          workspace,
        }),
      )
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(workspace.organizationId),
      })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", variables.workspaceId],
      })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", variables.workspaceId],
      })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", variables.workspaceId],
      })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", variables.workspaceId],
      })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", variables.workspaceId],
      })
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
        queryKey: ["workspace-comments", variables.workspaceId],
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
        queryKey: ["workspace-comments", variables.workspaceId],
      })
      queryClient.invalidateQueries({
        queryKey: workspaceThreadsQueryKey(variables.workspaceId),
      })
    },
  })
}
