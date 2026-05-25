import { ExternalLink, FileText } from "lucide-react"

import { useWorkspace } from "@/features/workspaces/hooks"
import { getWorkspaceEmoji } from "@/features/workspaces/queries"

export function DatabasePageCell({
  onOpen,
  pageId,
}: {
  onOpen?: (pageId: string) => void
  pageId: string
}) {
  const { data: page } = useWorkspace(pageId)
  const title = page?.name.trim() || "Untitled"
  const emoji = page ? getWorkspaceEmoji(page) : null

  return (
    <div className="database-page-link">
      <span className="database-page-main">
        <span className="database-page-icon">{emoji || <FileText />}</span>
        <span className="database-page-title">{title}</span>
      </span>
      <button
        className="database-page-open"
        onClick={() => onOpen?.(pageId)}
        type="button"
      >
        <ExternalLink />
        <span>Open</span>
      </button>
    </div>
  )
}
