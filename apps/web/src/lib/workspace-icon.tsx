import { FileIcon, FileTextIcon } from "lucide-react"

import { getWorkspaceEmoji, type Workspace } from "@notelab/features/workspaces"

export function hasWorkspaceContent(content: unknown): boolean {
  if (content === null || content === undefined) {
    return false
  }

  if (typeof content === "string") {
    return content.trim().length > 0
  }

  if (Array.isArray(content)) {
    return content.some(hasWorkspaceContent)
  }

  if (typeof content !== "object") {
    return true
  }

  const node = content as {
    attrs?: unknown
    content?: unknown
    text?: unknown
    type?: unknown
  }

  if (typeof node.text === "string" && node.text.trim().length > 0) {
    return true
  }

  if (
    typeof node.type === "string" &&
    !["doc", "paragraph", "text"].includes(node.type)
  ) {
    return true
  }

  return hasWorkspaceContent(node.content)
}

export function getWorkspaceIcon(
  workspace: Pick<Workspace, "content" | "metadata">,
) {
  const emoji = getWorkspaceEmoji(workspace)

  if (emoji) {
    return emoji
  }

  return hasWorkspaceContent(workspace.content) ? (
    <FileTextIcon className="size-4 text-muted-foreground" />
  ) : (
    <FileIcon className="size-4 text-muted-foreground" />
  )
}

export function WorkspacePageIcon({
  workspace,
}: {
  workspace: Pick<Workspace, "content" | "metadata">
}) {
  const icon = getWorkspaceIcon(workspace)

  if (typeof icon === "string") {
    return <span className="text-lg leading-none">{icon}</span>
  }

  return icon
}