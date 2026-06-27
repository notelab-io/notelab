import { useMemo, useState } from "react"
import type { Content, Extensions } from "@tiptap/core"
import type { TableOfContentDataItem } from "@tiptap/extension-table-of-contents"
import { normalizeEditorContent } from "./create-base-extensions"
import { createBaseExtensions } from "./create-base-extensions"
import type { UseEditorExtensionsOptions } from "./types"

export type { UseEditorExtensionsOptions }

export const useEditorExtensions = ({
  content,
  createEditorDatabase,
  databaseEditorRuntime,
  editable,
  onCreatePage,
  onEmbedPage,
  onOpenPage,
  organizationId,
  workspaceId,
}: UseEditorExtensionsOptions) => {
  const [tocItems, setTocItems] = useState<TableOfContentDataItem[]>([])

  const editorExtensions = useMemo<Extensions>(
    () =>
      createBaseExtensions({
        createEditorDatabase,
        databaseEditorRuntime,
        editable,
        onCreatePage,
        onEmbedPage,
        onOpenPage,
        onTocUpdate: setTocItems,
        organizationId,
        workspaceId,
      }),
    [
      createEditorDatabase,
      databaseEditorRuntime,
      editable,
      onCreatePage,
      onEmbedPage,
      onOpenPage,
      organizationId,
      workspaceId,
    ],
  )

  const editorLifecycleKey = workspaceId ?? "draft"
  const initialContent = normalizeEditorContent(content) as Content

  return {
    editorExtensions,
    editorLifecycleKey,
    initialContent,
    tocItems,
  }
}