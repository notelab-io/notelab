import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"

import type {
  WorkspaceEditPreviewClearOptions,
  WorkspaceEditPreviewRequest,
} from "@/editor/types"

export type WorkspaceEditorHandle = {
  acceptEditDiffPreview: () => boolean
  clearEditDiffPreview: (options?: WorkspaceEditPreviewClearOptions) => void
  getActiveEditDiffToolCallId: () => string | null
  getContentJson: () => unknown | null
  isEditDiffPreviewActive: () => boolean
  isEditable: () => boolean
  setContentFromMarkdown: (markdown: string) => boolean
  setContentJson: (content: unknown) => boolean
  showEditDiffPreview: (request: WorkspaceEditPreviewRequest) => boolean
}

export type { WorkspaceEditPreviewClearOptions, WorkspaceEditPreviewRequest }

type WorkspaceEditorRegistryValue = {
  getEditorHandle: (workspaceId: string) => WorkspaceEditorHandle | null
  registerEditor: (workspaceId: string, handle: WorkspaceEditorHandle) => void
  unregisterEditor: (workspaceId: string) => void
}

const WorkspaceEditorRegistryContext =
  createContext<WorkspaceEditorRegistryValue | null>(null)

export function WorkspaceEditorRegistryProvider({
  children,
}: {
  children: ReactNode
}) {
  const editorsRef = useRef(new Map<string, WorkspaceEditorHandle>())

  const registerEditor = useCallback(
    (workspaceId: string, handle: WorkspaceEditorHandle) => {
      editorsRef.current.set(workspaceId, handle)
    },
    [],
  )

  const unregisterEditor = useCallback((workspaceId: string) => {
    editorsRef.current.delete(workspaceId)
  }, [])

  const getEditorHandle = useCallback((workspaceId: string) => {
    return editorsRef.current.get(workspaceId) ?? null
  }, [])

  const value = useMemo(
    () => ({
      getEditorHandle,
      registerEditor,
      unregisterEditor,
    }),
    [getEditorHandle, registerEditor, unregisterEditor],
  )

  return (
    <WorkspaceEditorRegistryContext.Provider value={value}>
      {children}
    </WorkspaceEditorRegistryContext.Provider>
  )
}

export function useWorkspaceEditorRegistry() {
  const value = useContext(WorkspaceEditorRegistryContext)

  if (!value) {
    throw new Error(
      "useWorkspaceEditorRegistry must be used inside WorkspaceEditorRegistryProvider",
    )
  }

  return value
}