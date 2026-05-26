import { ExternalLink, FileText, X } from "lucide-react"

import { useWorkspaceSidePane } from "@/components/app-layout"
import { useWorkspace } from "@/features/workspaces/hooks"
import { getWorkspaceEmoji } from "@/features/workspaces/queries"

export function DatabasePageCell({
  onOpen,
  pageId,
}: {
  onOpen?: (pageId: string) => void
  pageId: string
}) {
  const { closeSidePane, sidePaneWorkspaceId } = useWorkspaceSidePane()
  const { data: page } = useWorkspace(pageId)
  const isOpen = sidePaneWorkspaceId === pageId
  const title = page?.name.trim() || "Untitled"
  const emoji = page ? getWorkspaceEmoji(page) : null
  const actionLabel = isOpen ? "Close" : "Open"
  const handleClick = () => {
    if (isOpen) {
      closeSidePane()
      return
    }

    onOpen?.(pageId)
  }

  return (
    <div className="database-page-link">
      <span className="database-page-main">
        <span className="database-page-icon">{emoji || <FileText />}</span>
        <span className="database-page-title">{title}</span>
      </span>
      <button
        className="database-page-open"
        onClick={handleClick}
        type="button"
      >
        {isOpen ? <X /> : <ExternalLink />}
        <span>{actionLabel}</span>
      </button>
    </div>
  )
}
