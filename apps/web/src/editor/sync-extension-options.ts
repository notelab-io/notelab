import type { MutableRefObject } from "react"
import type { Editor as TiptapEditor } from "@tiptap/react"
import type { DatabaseBlockEditorRuntime } from "@/packages/editor/extensions/database"

export const syncExtensionOptions = (
  editor: TiptapEditor,
  options: {
    databaseEditorRuntime: DatabaseBlockEditorRuntime
    editorEditable: boolean
    editorRuntimeRef: MutableRefObject<{
      editable: boolean
      listeners: Set<() => void>
    }>
    onOpenPage?: (pageId: string) => void
    workspaceId?: string | null
  }
) => {
  for (const extension of editor.extensionManager.extensions) {
    if (extension.name === "databaseBlock") {
      extension.options.currentPageId = options.workspaceId
      extension.options.editable = options.editorEditable
      extension.options.editorRuntime = options.databaseEditorRuntime
      extension.options.onOpenPage = options.onOpenPage
    }
    if (extension.name === "taskItem") {
      extension.options.editable = options.editorEditable
    }
    if (extension.name === "pageBlock" || extension.name === "slashCommand") {
      extension.options.onOpenPage = options.onOpenPage
    }
  }

  editor.setEditable(options.editorEditable)
  options.editorRuntimeRef.current.editable = options.editorEditable
  options.editorRuntimeRef.current.listeners.forEach((listener) => listener())
}