import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { FileText, LinkIcon, Loader2, Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useWorkspace, useWorkspaces } from "@/features/workspaces/hooks"
import { getWorkspaceEmoji } from "@/features/workspaces/queries"

export type CreatedPage = {
  id: string
}

export type PageBlockOptions = {
  currentPageId?: string | null
  onCreatePage?: () => Promise<CreatedPage>
  onOpenPage?: (pageId: string) => void
  organizationId?: string | null
}

function PageBlockView({
  extension,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const [isCreating, setIsCreating] = useState(false)
  const pageId = node.attrs.pageId as string | null
  const shouldOpenPicker = Boolean(node.attrs.openPicker)
  const [isOpen, setIsOpen] = useState(shouldOpenPicker)
  const { data: page } = useWorkspace(pageId)
  const title = page?.name.trim() || "Untitled"
  const emoji = page ? getWorkspaceEmoji(page) : null
  const options = extension.options as PageBlockOptions
  const { data: pages = [] } = useWorkspaces(options.organizationId)
  const linkablePages = pages.filter(
    (workspace) => workspace.id !== options.currentPageId
  )

  useEffect(() => {
    if (!shouldOpenPicker || pageId) {
      return
    }

    setIsOpen(true)
    updateAttributes({
      openPicker: false,
    })
  }, [pageId, shouldOpenPicker, updateAttributes])

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
      setIsOpen(false)
      options.onOpenPage?.(page.id)
    } finally {
      setIsCreating(false)
    }
  }

  const linkPage = (nextPageId: string) => {
    updateAttributes({
      pageId: nextPageId,
    })
    setIsOpen(false)
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
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              className="page-block-placeholder"
              contentEditable={false}
              type="button"
              variant="ghost"
            >
              <LinkIcon />
              <span>Link to page</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            avoidCollisions
            className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto p-2"
            collisionPadding={8}
            side="bottom"
            sideOffset={6}
          >
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Pages
            </div>
            <div className="grid gap-1">
              {linkablePages.length > 0 ? (
                linkablePages.map((workspace) => {
                  const workspaceTitle = workspace.name.trim() || "Untitled"
                  const workspaceEmoji = getWorkspaceEmoji(workspace)

                  return (
                    <button
                      className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                      key={workspace.id}
                      onClick={() => linkPage(workspace.id)}
                      type="button"
                    >
                      <span className="page-block-icon">
                        {workspaceEmoji || <FileText />}
                      </span>
                      <span className="min-w-0 truncate">{workspaceTitle}</span>
                    </button>
                  )
                })
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  No other pages yet.
                </div>
              )}
            </div>
            {options.onCreatePage ? (
              <>
                <div className="my-1 h-px bg-border" />
                <Button
                  className="page-block-create-option"
                  disabled={isCreating}
                  onClick={createPage}
                  type="button"
                  variant="ghost"
                >
                  {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                  <span>
                    {isCreating ? "Creating page..." : "Create nested page"}
                  </span>
                </Button>
              </>
            ) : null}
          </PopoverContent>
        </Popover>
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
      currentPageId: null,
      onCreatePage: undefined,
      onOpenPage: undefined,
      organizationId: null,
    }
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
      },
      openPicker: {
        default: false,
        rendered: false,
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
