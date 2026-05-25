import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { FileText, Loader2, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/features/workspaces/hooks"
import { getWorkspaceEmoji } from "@/features/workspaces/queries"

export type CreatedPage = {
  id: string
}

export type PageBlockOptions = {
  onCreatePage?: () => Promise<CreatedPage>
  onOpenPage?: (pageId: string) => void
}

function PageBlockView({
  extension,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const [isCreating, setIsCreating] = useState(false)
  const pageId = node.attrs.pageId as string | null
  const { data: page } = useWorkspace(pageId)
  const title = page?.name.trim() || "Untitled"
  const emoji = page ? getWorkspaceEmoji(page) : null
  const options = extension.options as PageBlockOptions

  const createPage = async () => {
    if (!options.onCreatePage || isCreating) {
      return
    }

    setIsCreating(true)

    try {
      const page = await options.onCreatePage()

      updateAttributes({
        pageId: page.id,
      })
      options.onOpenPage?.(page.id)
    } finally {
      setIsCreating(false)
    }
  }

  const openPage = () => {
    if (pageId) {
      options.onOpenPage?.(pageId)
    }
  }

  return (
    <NodeViewWrapper
      className="page-block"
      data-page-id={pageId ?? undefined}
      data-src={pageId ? "true" : "false"}
    >
      {pageId ? (
        <button
          className="page-block-preview"
          contentEditable={false}
          onClick={openPage}
          type="button"
        >
          <span className="page-block-icon">{emoji || <FileText />}</span>
          <span className="page-block-title">{title}</span>
        </button>
      ) : (
        <Button
          className="page-block-placeholder"
          contentEditable={false}
          disabled={isCreating || !options.onCreatePage}
          onClick={createPage}
          type="button"
          variant="ghost"
        >
          {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
          <span>{isCreating ? "Creating page..." : "Create nested page"}</span>
        </Button>
      )}
    </NodeViewWrapper>
  )
}

export const PageBlock = Node.create<PageBlockOptions>({
  name: "pageBlock",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  addOptions() {
    return {
      onCreatePage: undefined,
      onOpenPage: undefined,
    }
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="pageBlock"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "pageBlock" }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBlockView)
  },
})
