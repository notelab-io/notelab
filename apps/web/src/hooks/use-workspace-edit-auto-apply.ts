import { useEffect, useRef, useState } from "react"
import {
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai"

import {
  buildWorkspaceEditSnapshotMap,
  dedupeChatMessagesById,
  isProposePageContentUpdateToolName,
  isStalePageEditResolveError,
  type ProposePageContentUpdateOutput,
  type WorkspaceEditSnapshotPart,
  WORKSPACE_EDIT_SNAPSHOT_PART_TYPE,
} from "@notelab/features/ai-chat"
import { prosemirrorToMarkdown } from "@notelab/workspace-context"

import { useWorkspaceEditorRegistry } from "@/contexts/workspace-editor-registry"
import { useWorkspaceEditApplier } from "@/hooks/use-workspace-edit-applier"
import {
  logWorkspaceEdit,
  warnWorkspaceEdit,
} from "@notelab/features/ai-chat"

type UseWorkspaceEditAutoApplyOptions = {
  enabled?: boolean
  getContextPageMarkdown?: (workspaceId: string) => string | null
  messages: UIMessage[]
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void
}

function buildSnapshotMessage(snapshotPart: WorkspaceEditSnapshotPart) {
  return {
    id: crypto.randomUUID(),
    role: "data",
    parts: [snapshotPart],
  } as unknown as UIMessage
}

function upsertSnapshotMessage(
  messages: UIMessage[],
  snapshotPart: WorkspaceEditSnapshotPart,
) {
  const existingIndex = messages.findIndex(
    (entry) =>
      (entry.role as string) === "data" &&
      entry.parts.some((entryPart) => {
        const snapshot = entryPart as unknown as WorkspaceEditSnapshotPart
        return (
          snapshot.type === WORKSPACE_EDIT_SNAPSHOT_PART_TYPE &&
          snapshot.toolCallId === snapshotPart.toolCallId
        )
      }),
  )

  if (existingIndex === -1) {
    return dedupeChatMessagesById([
      ...messages,
      buildSnapshotMessage(snapshotPart),
    ])
  }

  return dedupeChatMessagesById(
    messages.map((entry, index) => {
      if (index !== existingIndex) {
        return entry
      }

      return {
        ...entry,
        parts: [snapshotPart],
      } as unknown as UIMessage
    }),
  )
}

function readEditorSnapshotState(workspaceId: string, getEditorHandle: ReturnType<
  typeof useWorkspaceEditorRegistry
>["getEditorHandle"]) {
  const beforeContentJson = getEditorHandle(workspaceId)?.getContentJson() ?? null

  return {
    beforeContentJson,
    beforeMarkdown: beforeContentJson
      ? prosemirrorToMarkdown(beforeContentJson)
      : "",
  }
}

export function useWorkspaceEditAutoApply({
  enabled = true,
  getContextPageMarkdown,
  messages,
  setMessages,
}: UseWorkspaceEditAutoApplyOptions) {
  const { getEditorHandle } = useWorkspaceEditorRegistry()
  const { resolvePageEdit } = useWorkspaceEditApplier()
  const processedToolCallIdsRef = useRef(new Set<string>())
  const [applyingToolCallIds, setApplyingToolCallIds] = useState<string[]>([])

  useEffect(() => {
    for (const message of messages) {
      if ((message.role as string) !== "data") {
        continue
      }

      for (const part of message.parts) {
        const snapshotPart = part as unknown as WorkspaceEditSnapshotPart

        if (
          snapshotPart.type === WORKSPACE_EDIT_SNAPSHOT_PART_TYPE &&
          typeof snapshotPart.toolCallId === "string"
        ) {
          processedToolCallIdsRef.current.add(snapshotPart.toolCallId)
        }
      }
    }
  }, [messages])

  useEffect(() => {
    if (!enabled) {
      logWorkspaceEdit("autoApply:disabled")
      return
    }

    const snapshotByToolCallId = buildWorkspaceEditSnapshotMap(messages)

    for (const message of messages) {
      if (message.role !== "assistant") {
        continue
      }

      for (const part of message.parts) {
        if (!isToolUIPart(part)) {
          continue
        }

        const toolName = getToolName(part)

        if (!isProposePageContentUpdateToolName(toolName)) {
          continue
        }

        if (part.state === "output-error" || part.errorText) {
          warnWorkspaceEdit("autoApply:tool-error", {
            errorText: part.errorText,
            input: part.input,
            toolCallId: part.toolCallId,
          })
          continue
        }

        if (part.state !== "output-available") {
          continue
        }

        const toolCallId = part.toolCallId

        if (
          processedToolCallIdsRef.current.has(toolCallId) ||
          snapshotByToolCallId.has(toolCallId)
        ) {
          processedToolCallIdsRef.current.add(toolCallId)
          continue
        }

        processedToolCallIdsRef.current.add(toolCallId)

        const output = part.output as ProposePageContentUpdateOutput | undefined

        if (!output?.workspaceId) {
          warnWorkspaceEdit("autoApply:missing-output", {
            output,
            toolCallId,
          })
          continue
        }

        const editMode =
          output.editMode ??
          (output.searchText ? "patch" : output.afterMarkdown ? "full" : null)

        if (!editMode) {
          warnWorkspaceEdit("autoApply:missing-edit-mode", {
            output,
            toolCallId,
          })
          continue
        }

        if (
          editMode === "full" &&
          (!output.afterMarkdown || !output.afterMarkdown.trim())
        ) {
          warnWorkspaceEdit("autoApply:missing-full-output", {
            output,
            toolCallId,
          })
          continue
        }

        if (
          editMode === "patch" &&
          (!output.searchText || !output.searchText.trim())
        ) {
          warnWorkspaceEdit("autoApply:missing-patch-output", {
            output,
            toolCallId,
          })
          continue
        }

        logWorkspaceEdit("autoApply:tool-output", {
          editMode,
          summary: output.summary,
          toolCallId,
          workspaceId: output.workspaceId,
        })

        setApplyingToolCallIds((current) =>
          current.includes(toolCallId) ? current : [...current, toolCallId],
        )

        const resolveResult = resolvePageEdit({
          afterMarkdown: output.afterMarkdown,
          contextPageMarkdown: getContextPageMarkdown?.(output.workspaceId) ?? null,
          editMode,
          replaceText: output.replaceText,
          searchText: output.searchText,
          workspaceId: output.workspaceId,
        })

        if (resolveResult.success) {
          logWorkspaceEdit("autoApply:snapshot-ready", {
            toolCallId,
            workspaceId: output.workspaceId,
          })
        } else {
          warnWorkspaceEdit("autoApply:snapshot-failed", {
            errorMessage: resolveResult.errorMessage,
            toolCallId,
            workspaceId: output.workspaceId,
          })
        }

        const snapshotPart: WorkspaceEditSnapshotPart = resolveResult.success
          ? {
              type: WORKSPACE_EDIT_SNAPSHOT_PART_TYPE,
              toolCallId,
              parentMessageId: message.id,
              workspaceId: output.workspaceId,
              summary: output.summary,
              beforeMarkdown: resolveResult.beforeMarkdown,
              afterMarkdown: resolveResult.afterMarkdown,
              beforeContentJson: resolveResult.beforeContentJson,
              status: "preview",
              appliedAt: new Date().toISOString(),
            }
          : isStalePageEditResolveError(resolveResult.errorMessage)
            ? {
                type: WORKSPACE_EDIT_SNAPSHOT_PART_TYPE,
                toolCallId,
                parentMessageId: message.id,
                workspaceId: output.workspaceId,
                summary: output.summary,
                ...readEditorSnapshotState(output.workspaceId, getEditorHandle),
                afterMarkdown: output.afterMarkdown?.trim() ?? "",
                status: "declined",
                appliedAt: new Date().toISOString(),
              }
            : {
                type: WORKSPACE_EDIT_SNAPSHOT_PART_TYPE,
                toolCallId,
                parentMessageId: message.id,
                workspaceId: output.workspaceId,
                summary: output.summary,
                beforeMarkdown: "",
                afterMarkdown:
                  output.afterMarkdown ??
                  output.replaceText ??
                  "",
                beforeContentJson: null,
                status: "failed",
                appliedAt: new Date().toISOString(),
                errorMessage: resolveResult.errorMessage,
              }

        setApplyingToolCallIds((current) =>
          current.filter((entry) => entry !== toolCallId),
        )

        setMessages((currentMessages) =>
          upsertSnapshotMessage(currentMessages, snapshotPart),
        )
      }
    }
  }, [
    enabled,
    getContextPageMarkdown,
    getEditorHandle,
    messages,
    resolvePageEdit,
    setMessages,
  ])

  return {
    applyingToolCallIds,
  }
}

export function updateWorkspaceEditSnapshotStatus(
  messages: UIMessage[],
  toolCallId: string,
  status: WorkspaceEditSnapshotPart["status"],
  options?: {
    afterContentJson?: unknown
  },
) {
  return dedupeChatMessagesById(
    messages.map((message) => {
      if ((message.role as string) !== "data") {
        return message
      }

      return {
        ...message,
        parts: message.parts.map((part) => {
          const snapshot = part as unknown as WorkspaceEditSnapshotPart

          if (
            snapshot.type !== WORKSPACE_EDIT_SNAPSHOT_PART_TYPE ||
            snapshot.toolCallId !== toolCallId
          ) {
            return part
          }

          return {
            ...snapshot,
            status,
            afterContentJson:
              options?.afterContentJson ?? snapshot.afterContentJson,
            appliedAt:
              status === "applied"
                ? new Date().toISOString()
                : snapshot.appliedAt,
            undoneAt:
              status === "undone"
                ? new Date().toISOString()
                : snapshot.undoneAt,
          } as unknown as typeof part
        }),
      }
    }),
  )
}