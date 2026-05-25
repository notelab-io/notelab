import { useMutation, useQuery } from "@tanstack/react-query"

import {
  workspaceQueryKey,
  workspaceQueryOptions,
  workspacesQueryKey,
  workspacesQueryOptions,
  type Workspace,
  type WorkspaceMetadata,
} from "@/features/workspaces/queries"
import { apiFetch } from "@/lib/api"
import { queryClient } from "@/lib/query-client"

type CreateWorkspaceInput = {
  content?: unknown
  organizationId: string
  name?: string
  emoji?: string
  parentWorkspaceId?: string
}

type UpdateWorkspaceInput = {
  id: string
  content?: unknown
  name?: string
  metadata?: WorkspaceMetadata
}

export function useWorkspaces(organizationId: string | null | undefined) {
  return useQuery(workspacesQueryOptions(organizationId))
}

export function useWorkspace(workspaceId: string | null | undefined) {
  return useQuery(workspaceQueryOptions(workspaceId))
}

export function useCreateWorkspace() {
  return useMutation({
    mutationFn: async ({
      content = null,
      organizationId,
      name = "",
      emoji,
      parentWorkspaceId,
    }: CreateWorkspaceInput) => {
      const metadata: WorkspaceMetadata = {}

      if (emoji) {
        metadata.emoji = emoji
      }

      if (parentWorkspaceId) {
        metadata.parentWorkspaceId = parentWorkspaceId
      }

      const result = await apiFetch<{ workspace: Workspace }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          name,
          type: "pageblock",
          url: "#",
          content,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        }),
      })

      return result.workspace
    },
    onSuccess: async (workspace) => {
      queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace)
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(workspace.organizationId),
      })
    },
  })
}

export function useUpdateWorkspace() {
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
    onSuccess: async (workspace) => {
      queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace)
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryKey(workspace.organizationId),
      })
    },
  })
}
