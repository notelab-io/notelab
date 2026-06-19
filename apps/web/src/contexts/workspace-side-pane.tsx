import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type WorkspaceSidePaneContextValue = {
  closeSidePane: () => void
  openSidePane: (workspaceId: string) => void
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
  const closeSidePane = useCallback(() => {
    setSidePaneWorkspaceId(null)
  }, [])
  const openSidePane = useCallback((nextWorkspaceId: string) => {
    setSidePaneWorkspaceId(nextWorkspaceId)
  }, [])
  const sidePaneContext = useMemo<WorkspaceSidePaneContextValue>(
    () => ({
      closeSidePane,
      openSidePane,
      sidePaneWorkspaceId,
    }),
    [closeSidePane, openSidePane, sidePaneWorkspaceId],
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