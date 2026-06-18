import type { QueryClient } from "@tanstack/react-query"

import {
  workspaceCommentsQueryKey,
  workspaceQueryKey,
  workspaceThreadsQueryKey,
  workspacesQueryKey,
} from "./queries"
import type { WorkspaceRealtimeEvent } from "./realtime-utils"

const refetchDebounceMs = 120

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

  const scheduleWorkspaceRefetch = (eventOrganizationId?: string | null) => {
    if (workspaceRefetchTimeout !== null) {
      window.clearTimeout(workspaceRefetchTimeout)
    }

    workspaceRefetchTimeout = window.setTimeout(() => {
      workspaceRefetchTimeout = null
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspacesQueryKey(eventOrganizationId ?? organizationId),
        }),
        queryClient.invalidateQueries({ queryKey: ["database"] }),
      ])
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
      scheduleWorkspaceRefetch(message.organizationId)
      return
    }

    if (message.type === "comments.changed") {
      scheduleCommentsRefetch(message.threadId)
    }
  }

  const scheduleReconnectRefetch = () => {
    scheduleWorkspaceRefetch()
    scheduleCommentsRefetch()
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