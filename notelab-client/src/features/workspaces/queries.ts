import { queryOptions } from "@tanstack/react-query"

import { ApiError, apiFetch } from "@/lib/api"

export type WorkspaceMetadata = {
  emoji?: string | null
  parentWorkspaceId?: string | null
}

export type Workspace = {
  id: string
  organizationId: string
  createdById?: string | null
  type: string
  name: string
  url: string
  content?: unknown
  metadata?: WorkspaceMetadata | null
  deletedById?: string | null
  deletedAt?: string | null
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

export type WorkspacePropertyValue = {
  id: string
  workspaceId: string
  propertyId: string
  value: unknown
  createdAt: string
  updatedAt: string
}

export type WorkspacePropertiesPayload = {
  properties: WorkspaceProperty[]
  values: WorkspacePropertyValue[]
}

export const workspacesQueryKey = (organizationId: string | null | undefined) =>
  ["workspaces", organizationId ?? "none"] as const

export const workspaceQueryKey = (workspaceId: string | null | undefined) =>
  ["workspace", workspaceId ?? "none"] as const

export const workspacePropertiesQueryKey = (
  workspaceId: string | null | undefined,
) => ["workspace-properties", workspaceId ?? "none"] as const

export const workspacesQueryOptions = (
  organizationId: string | null | undefined,
) =>
  queryOptions({
    queryKey: workspacesQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) {
        return []
      }

      try {
        const result = await apiFetch<{ workspaces: Workspace[] }>(
          `/workspaces?organizationId=${encodeURIComponent(organizationId)}`,
          { method: "GET" },
        )

        return result.workspaces
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return []
        }

        throw error
      }
    },
  })

export const workspaceQueryOptions = (workspaceId: string | null | undefined) =>
  queryOptions({
    queryKey: workspaceQueryKey(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error("workspaceId is required")
      }

      const result = await apiFetch<{ workspace: Workspace }>(
        `/workspaces/${workspaceId}`,
        { method: "GET" },
      )

      return result.workspace
    },
  })

export const workspacePropertiesQueryOptions = (
  workspaceId: string | null | undefined,
) =>
  queryOptions({
    queryKey: workspacePropertiesQueryKey(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error("workspaceId is required")
      }

      return apiFetch<WorkspacePropertiesPayload>(
        `/workspaces/${workspaceId}/properties`,
        { method: "GET" },
      )
    },
  })

export function getWorkspaceEmoji(workspace: Pick<Workspace, "metadata">) {
  return workspace.metadata?.emoji ?? null
}
