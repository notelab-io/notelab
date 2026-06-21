import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { MutableRefObject } from "react"

import { useWorkspaceEditorRegistry } from "@/contexts/workspace-editor-registry"
import type { Content, Editor } from "@tiptap/core"

import type { WorkspaceEditorHandle } from "@/contexts/workspace-editor-registry"
import { parseMarkdownContent } from "@/editor/editor-ai-utils"
import type { WorkspaceEditPreviewControls } from "@/editor/types"
import { useNotelabFeatures } from "@notelab/features"
import { workspaceQueryKey, type WorkspaceDetail } from "@notelab/features/workspaces"
import {
  logWorkspaceEdit,
  resolvePageEditMarkdown,
  warnWorkspaceEdit,
  type ProposePageContentUpdateOutput,
} from "@notelab/features/ai-chat"
import { prosemirrorToMarkdown } from "@notelab/workspace-context"

type ResolvePageEditInput = Pick<
  ProposePageContentUpdateOutput,
  | "afterMarkdown"
  | "editMode"
  | "replaceText"
  | "searchText"
  | "workspaceId"
> & {
  contextPageMarkdown?: string | null
}

type ResolvePageEditResult =
  | {
      afterMarkdown: string
      beforeContentJson: unknown
      beforeMarkdown: string
      success: true
    }
  | {
      errorMessage: string
      success: false
    }

type CommitPageEditResult =
  | { success: true }
  | {
      errorMessage: string
      success: false
    }

export function useWorkspaceEditApplier() {
  const { getEditorHandle } = useWorkspaceEditorRegistry()
  const { apiFetch } = useNotelabFeatures()
  const queryClient = useQueryClient()

  const resolvePageEdit = useCallback(
    (input: ResolvePageEditInput): ResolvePageEditResult => {
      logWorkspaceEdit("resolvePageEdit:start", {
        editMode: input.editMode,
        workspaceId: input.workspaceId,
      })

      const handle = getEditorHandle(input.workspaceId)

      if (!handle) {
        warnWorkspaceEdit("resolvePageEdit:no-editor-handle", {
          workspaceId: input.workspaceId,
        })
        return {
          errorMessage:
            "Open the target page in the editor before applying this change.",
          success: false,
        }
      }

      if (!handle.isEditable()) {
        warnWorkspaceEdit("resolvePageEdit:not-editable", {
          workspaceId: input.workspaceId,
        })
        return {
          errorMessage: "You do not have permission to edit this page.",
          success: false,
        }
      }

      const beforeContentJson = handle.getContentJson()

      if (beforeContentJson == null) {
        warnWorkspaceEdit("resolvePageEdit:empty-content", {
          workspaceId: input.workspaceId,
        })
        return {
          errorMessage: "The page editor is not ready yet.",
          success: false,
        }
      }

      const beforeMarkdown = prosemirrorToMarkdown(beforeContentJson)
      const resolved = resolvePageEditMarkdown({
        afterMarkdown: input.afterMarkdown,
        beforeMarkdown,
        contextPageMarkdown: input.contextPageMarkdown,
        editMode: input.editMode,
        replaceText: input.replaceText,
        searchText: input.searchText,
      })

      if (!resolved.success) {
        warnWorkspaceEdit("resolvePageEdit:resolve-failed", {
          contextChars: input.contextPageMarkdown?.length ?? 0,
          editMode: input.editMode,
          editorChars: beforeMarkdown.length,
          errorMessage: resolved.errorMessage,
          searchPreview: input.searchText?.slice(0, 160) ?? "",
          workspaceId: input.workspaceId,
        })
        return {
          errorMessage: resolved.errorMessage,
          success: false,
        }
      }

      logWorkspaceEdit("resolvePageEdit:success", {
        afterChars: resolved.afterMarkdown.length,
        beforeChars: beforeMarkdown.length,
        editMode: input.editMode,
        patchSource: "patchSource" in resolved ? resolved.patchSource : "full",
        workspaceId: input.workspaceId,
      })

      return {
        afterMarkdown: resolved.afterMarkdown,
        beforeContentJson,
        beforeMarkdown,
        success: true,
      }
    },
    [getEditorHandle],
  )

  const commitPageEdit = useCallback(
    (input: {
      afterMarkdown: string
      workspaceId: string
    }): CommitPageEditResult => {
      const handle = getEditorHandle(input.workspaceId)

      if (!handle?.isEditable()) {
        return {
          errorMessage: "You do not have permission to edit this page.",
          success: false,
        }
      }

      if (!handle.setContentFromMarkdown(input.afterMarkdown)) {
        return {
          errorMessage: "The AI update could not be parsed into page content.",
          success: false,
        }
      }

      logWorkspaceEdit("commitPageEdit:success", {
        workspaceId: input.workspaceId,
      })

      return { success: true }
    },
    [getEditorHandle],
  )

  const undoPageEdit = useCallback(
    async (input: {
      beforeContentJson: unknown
      workspaceId: string
    }) => {
      const handle = getEditorHandle(input.workspaceId)

      if (handle?.isEditable()) {
        if (!handle.setContentJson(input.beforeContentJson)) {
          return {
            errorMessage: "The page editor could not restore the previous version.",
            success: false as const,
          }
        }

        return { success: true as const }
      }

      const organizationId = readOrganizationIdFromWorkspaceDetail(
        queryClient.getQueryData<WorkspaceDetail | null>(
          workspaceQueryKey(input.workspaceId),
        ),
      )

      if (!organizationId) {
        return {
          errorMessage:
            "Open the page or reload it before undoing this change.",
          success: false as const,
        }
      }

      await apiFetch(`/api/workspaces/${encodeURIComponent(input.workspaceId)}`, {
        body: JSON.stringify({ content: input.beforeContentJson }),
        headers: {
          "Content-Type": "application/json",
          "x-notelab-organization-id": organizationId,
        },
        method: "PATCH",
      })

      return { success: true as const }
    },
    [apiFetch, getEditorHandle, queryClient],
  )

  return {
    commitPageEdit,
    resolvePageEdit,
    undoPageEdit,
  }
}

function readOrganizationIdFromWorkspaceDetail(detail: WorkspaceDetail | null | undefined) {
  return detail?.workspace?.organizationId ?? null
}

export function createWorkspaceEditorHandle(input: {
  editable: boolean
  getEditor: () => Editor | null
  onContentChange?: (content: unknown) => void
  workspaceEditPreviewRef?: MutableRefObject<WorkspaceEditPreviewControls | null>
}): WorkspaceEditorHandle {
  const applyContent = (content: unknown) => {
    const editor = input.getEditor()

    if (!editor || !input.editable) {
      return false
    }

    editor.commands.setContent(content as Content)
    input.onContentChange?.(editor.getJSON())
    return true
  }

  const getPreviewControls = () => input.workspaceEditPreviewRef?.current ?? null

  return {
    acceptEditDiffPreview: () => getPreviewControls()?.accept() ?? false,
    clearEditDiffPreview: (options) => {
      getPreviewControls()?.clear(options)
    },
    getActiveEditDiffToolCallId: () => getPreviewControls()?.toolCallId() ?? null,
    getContentJson: () => input.getEditor()?.getJSON() ?? null,
    isEditDiffPreviewActive: () => getPreviewControls()?.isActive() ?? false,
    isEditable: () => input.editable,
    setContentFromMarkdown: (markdown) => {
      const editor = input.getEditor()

      if (!editor || !input.editable) {
        return false
      }

      const parsed = parseMarkdownContent(editor, markdown, {
        unwrapPlainFencedBlock: true,
      })

      if (!parsed) {
        return false
      }

      return applyContent({
        type: "doc",
        content: parsed.content,
      })
    },
    setContentJson: (content) => applyContent(content),
    showEditDiffPreview: (request) => getPreviewControls()?.show(request) ?? false,
  }
}