import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type OpenWorkspaceSidePaneOptions = {
  databaseId?: string | null
}

export type WorkspaceSidePaneContextValue = {
  closeSidePane: () => void
  openSidePane: (
    workspaceId: string,
    options?: OpenWorkspaceSidePaneOptions,
  ) => void
  sidePaneDatabaseId: string | null
  sidePaneWorkspaceId: string | null
}

export const WorkspaceSidePaneContext =
  createContext<WorkspaceSidePaneContextValue | null>(null)

const sidePaneWidthClass = "w-full min-w-0 md:basis-0 md:flex-1"

export function WorkspaceSidePaneProvider({
  children,
  resetKey,
}: {
  children: ReactNode
  resetKey?: string | null
}) {
  const [sidePaneWorkspaceId, setSidePaneWorkspaceId] = useState<string | null>(
    null,
  )
  const [sidePaneDatabaseId, setSidePaneDatabaseId] = useState<string | null>(
    null,
  )
  const closeSidePane = useCallback(() => {
    setSidePaneWorkspaceId(null)
    setSidePaneDatabaseId(null)
  }, [])
  const openSidePane = useCallback(
    (nextWorkspaceId: string, options?: OpenWorkspaceSidePaneOptions) => {
      setSidePaneWorkspaceId(nextWorkspaceId)
      setSidePaneDatabaseId(options?.databaseId ?? null)
    },
    [],
  )
  const sidePaneContext = useMemo<WorkspaceSidePaneContextValue>(
    () => ({
      closeSidePane,
      openSidePane,
      sidePaneDatabaseId,
      sidePaneWorkspaceId,
    }),
    [closeSidePane, openSidePane, sidePaneDatabaseId, sidePaneWorkspaceId],
  )

  useEffect(() => {
    closeSidePane()
  }, [closeSidePane, resetKey])

  return (
    <WorkspaceSidePaneContext.Provider value={sidePaneContext}>
      {children}
    </WorkspaceSidePaneContext.Provider>
  )
}

export function useWorkspaceSidePane() {
  const context = useContext(WorkspaceSidePaneContext)

  if (!context) {
    throw new Error("useWorkspaceSidePane must be used inside a side pane provider")
  }

  return context
}

export function useOptionalWorkspaceSidePane() {
  return useContext(WorkspaceSidePaneContext)
}

export function getWorkspaceSidePaneWidthClass() {
  return sidePaneWidthClass
}