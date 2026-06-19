import { useEffect, useMemo, useState } from "react"
import type { Content, Extensions } from "@tiptap/core"
import type { TableOfContentDataItem } from "@tiptap/extension-table-of-contents"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import type { DatabaseBlockEditorRuntime } from "@/packages/editor/extensions/database"
import type { CreatedPage } from "@/packages/editor/extensions/page-block"
import {
  createCollaborationSeedUpdate,
  normalizeEditorContent,
  renderCollaborationCaret,
  renderCollaborationSelection,
} from "./collaboration"
import { createBaseExtensions } from "./create-base-extensions"
import { useWorkspaceCollaboration } from "./use-workspace-collaboration"

type UseEditorExtensionsOptions = {
  content: unknown
  createEditorDatabase: () => Promise<string | null>
  databaseEditorRuntime: DatabaseBlockEditorRuntime
  editable: boolean
  onCollaborationReadyChange?: (ready: boolean) => void
  onCreatePage?: () => Promise<CreatedPage>
  onEmbedPage?: (pageId: string) => void | Promise<void>
  onOpenPage?: (pageId: string) => void
  organizationId?: string | null
  workspaceId?: string | null
  workspaceUpdatedAt?: string | null
}

export const useEditorExtensions = ({
  content,
  createEditorDatabase,
  databaseEditorRuntime,
  editable,
  onCollaborationReadyChange,
  onCreatePage,
  onEmbedPage,
  onOpenPage,
  organizationId,
  workspaceId,
  workspaceUpdatedAt,
}: UseEditorExtensionsOptions) => {
  const [tocItems, setTocItems] = useState<TableOfContentDataItem[]>([])
  const collaborationEnabled = editable && Boolean(workspaceId)

  const baseExtensions = useMemo(
    () =>
      createBaseExtensions({
        collaborationEnabled,
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
      collaborationEnabled,
      createEditorDatabase,
      databaseEditorRuntime,
      editable,
      onCreatePage,
      onEmbedPage,
      onOpenPage,
      organizationId,
      workspaceId,
    ]
  )

  const seedUpdate = useMemo(
    () =>
      collaborationEnabled
        ? createCollaborationSeedUpdate(content, baseExtensions)
        : null,
    [baseExtensions, collaborationEnabled, content]
  )

  const collaboration = useWorkspaceCollaboration({
    enabled: collaborationEnabled,
    seedUpdate,
    workspaceId,
    workspaceUpdatedAt,
  })

  const { provider, user, ydoc } = collaboration
  const collaborationReady = Boolean(provider && user && ydoc)

  const editorExtensions = useMemo<Extensions>(() => {
    if (!collaborationReady || !provider || !user || !ydoc) {
      return baseExtensions
    }
    return [
      ...baseExtensions,
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user,
        render: renderCollaborationCaret,
        selectionRender: renderCollaborationSelection,
      }),
    ]
  }, [baseExtensions, collaborationReady, provider, user, ydoc])

  const editorLifecycleKey = `${workspaceId ?? "draft"}:${
    collaborationReady ? "collaboration" : "plain"
  }`

  const initialContent: Content | undefined = collaborationReady
    ? undefined
    : (normalizeEditorContent(content) as Content)

  useEffect(() => {
    onCollaborationReadyChange?.(collaborationReady)
  }, [collaborationReady, onCollaborationReadyChange])

  return {
    editorExtensions,
    editorLifecycleKey,
    initialContent,
    tocItems,
  }
}