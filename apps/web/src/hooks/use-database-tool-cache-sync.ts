import { useEffect, useRef } from "react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { useQueryClient } from "@tanstack/react-query"

import {
  isDatabaseConfigToolName,
  readDatabaseConfigToolIds,
} from "@notelab/features/ai-chat"
import { databaseQueryKey } from "@notelab/features/databases"
import { workspaceQueryKey } from "@notelab/features/workspaces"

type UseDatabaseToolCacheSyncOptions = {
  enabled?: boolean
  messages: UIMessage[]
}

function collectInvalidationTargets(ids: Record<string, string>) {
  const databaseIds = new Set<string>()
  const workspaceIds = new Set<string>()

  for (const [key, value] of Object.entries(ids)) {
    if (!value) {
      continue
    }

    if (key === "databaseId" || key.endsWith("DatabaseId")) {
      databaseIds.add(value)
    }

    if (
      key === "workspaceId" ||
      key === "pageId" ||
      key === "hostWorkspaceId" ||
      key === "rowPageId" ||
      key.endsWith("WorkspaceId")
    ) {
      workspaceIds.add(value)
    }
  }

  return { databaseIds, workspaceIds }
}

export function useDatabaseToolCacheSync({
  enabled = true,
  messages,
}: UseDatabaseToolCacheSyncOptions) {
  const queryClient = useQueryClient()
  const handledToolCallIds = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled) {
      return
    }

    for (const message of messages) {
      if (message.role !== "assistant") {
        continue
      }

      for (const part of message.parts) {
        if (!isToolUIPart(part) || part.state !== "output-available") {
          continue
        }

        const toolName = getToolName(part)

        if (!isDatabaseConfigToolName(toolName)) {
          continue
        }

        if (handledToolCallIds.current.has(part.toolCallId)) {
          continue
        }

        const ids = readDatabaseConfigToolIds(part.output)

        if (!ids) {
          continue
        }

        handledToolCallIds.current.add(part.toolCallId)

        const { databaseIds, workspaceIds } = collectInvalidationTargets(ids)

        for (const databaseId of databaseIds) {
          void queryClient.invalidateQueries({
            queryKey: databaseQueryKey(databaseId),
          })
        }

        for (const workspaceId of workspaceIds) {
          void queryClient.invalidateQueries({
            queryKey: workspaceQueryKey(workspaceId),
          })
        }
      }
    }
  }, [enabled, messages, queryClient])
}