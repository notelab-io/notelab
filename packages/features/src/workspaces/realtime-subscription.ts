import type { QueryClient } from "@tanstack/react-query"

import {
  workspaceCommentsQueryKey,
  workspaceQueryKey,
  workspaceThreadsQueryKey,
  workspacesQueryKey,
} from "./queries"
import type {
  WorkspaceChangedEvent,
  WorkspaceRealtimeEvent,
} from "./realtime-utils"

const refetchDebounceMs = 120

type WorkspaceChangedField = WorkspaceChangedEvent["changed"][number]

export function shouldInvalidateWorkspaceDetail(
  changed?: WorkspaceChangedField[],
) {
  if (!changed || changed.length === 0) {
    return true
  }

  return changed.some((field) => field === "name" || field === "metadata")
}

export function shouldInvalidateWorkspacesNav(
  changed?: WorkspaceChangedField[],
) {
  if (!changed || changed.length === 0) {
    return true
  }

  return changed.some((field) => field === "name" || field === "metadata")
}

type WorkspaceRealtimeSubscriptionOptions = {
  organizationId?: string | null
  queryClient: QueryClient
  workspaceId: string
}

export function createWorkspaceRealtimeSubscription({
  organizationId = null,
  queryClient,
  workspaceId,
}: WorkspaceRealtimeSubscriptionOptions) {
  let workspaceRefetchTimeout: number | null = null
  let commentsRefetchTimeout: number | null = null

  const scheduleWorkspaceRefetch = (
    eventOrganizationId?: string | null,
    changed?: WorkspaceChangedField[],
  ) => {
    const invalidateWorkspace = shouldInvalidateWorkspaceDetail(changed)
    const invalidateNav = shouldInvalidateWorkspacesNav(changed)

    if (!invalidateWorkspace && !invalidateNav) {
      return
    }

    if (workspaceRefetchTimeout !== null) {
      window.clearTimeout(workspaceRefetchTimeout)
    }

    workspaceRefetchTimeout = window.setTimeout(() => {
      workspaceRefetchTimeout = null

      const invalidations = []

      if (invalidateWorkspace) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKey(workspaceId),
          }),
        )
      }

      if (invalidateNav) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: workspacesQueryKey(eventOrganizationId ?? organizationId),
          }),
        )
      }

      void Promise.all(invalidations)
    }, refetchDebounceMs)
  }

  const scheduleCommentsRefetch = (threadId?: string | null) => {
    if (commentsRefetchTimeout !== null) {
      window.clearTimeout(commentsRefetchTimeout)
    }

    commentsRefetchTimeout = window.setTimeout(() => {
      commentsRefetchTimeout = null

      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: workspaceCommentsQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceThreadsQueryKey(workspaceId),
        }),
      ]

      if (threadId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: workspaceCommentsQueryKey(workspaceId, threadId),
          }),
        )
      }

      void Promise.all(invalidations)
    }, refetchDebounceMs)
  }

  const handleEvent = (message: WorkspaceRealtimeEvent) => {
    if (message.workspaceId !== workspaceId) {
      return
    }

    if (message.type === "workspace.changed") {
      scheduleWorkspaceRefetch(message.organizationId, message.changed)
      return
    }

    if (message.type === "comments.changed") {
      scheduleCommentsRefetch(message.threadId)
    }
  }

  const scheduleReconnectRefetch = () => {
    // Live edits arrive over the workspace realtime channel. Refetching the
    // full workspace and nav list on every reconnect caused duplicate loads.
  }

  const dispose = () => {
    if (workspaceRefetchTimeout !== null) {
      window.clearTimeout(workspaceRefetchTimeout)
      workspaceRefetchTimeout = null
    }

    if (commentsRefetchTimeout !== null) {
      window.clearTimeout(commentsRefetchTimeout)
      commentsRefetchTimeout = null
    }
  }

  return {
    dispose,
    handleEvent,
    scheduleReconnectRefetch,
  }
}