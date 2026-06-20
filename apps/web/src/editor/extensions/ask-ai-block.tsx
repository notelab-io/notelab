import { Node, mergeAttributes, type JSONContent } from "@tiptap/core"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import type { Editor, Range } from "@tiptap/core"
import { Loader2, Send, Sparkles, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { toast } from "sonner"

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { getApiRequestHeaders, toApiUrl } from "@/lib/api"

type GeneratedRange = {
  from: number
  to: number
}

export type AskAiBlockOptions = {
  organizationId?: string | null
}

type AskAiAnchorRect = {
  bottom: number
  left: number
  right: number
  top: number
}

type AskAiPopoverProps = {
  anchorRect: AskAiAnchorRect
  editor: Editor
  insertPos: number
  onDone: () => void
  organizationId?: string | null
}

function AskAiPopover({
  anchorRect,
  editor,
  insertPos,
  onDone,
  organizationId,
}: AskAiPopoverProps) {
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [prompt, setPrompt] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const generatedRangeRef = useRef<GeneratedRange | null>(null)
  const isStreamingRef = useRef(false)
  const latestMarkdownRef = useRef("")

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const cleanupIfIdle = () => {
    if (!isStreamingRef.current) {
      onDone()
    }
  }

  const replaceGeneratedContent = (markdown: string) => {
    const parsed = parseMarkdownContent(editor, markdown)

    if (!parsed) {
      return
    }

    const currentRange = generatedRangeRef.current

    if (currentRange) {
      editor
        .chain()
        .focus()
        .insertContentAt(currentRange, parsed.content, {
          updateSelection: false,
        })
        .run()

      generatedRangeRef.current = {
        from: currentRange.from,
        to: currentRange.from + parsed.size,
      }
      return
    }

    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, parsed.content, {
        updateSelection: false,
      })
      .run()

    generatedRangeRef.current = {
      from: insertPos,
      to: insertPos + parsed.size,
    }
  }

  const finishStreaming = () => {
    const range = generatedRangeRef.current

    if (!range) {
      editor.chain().focus().setTextSelection(insertPos).run()
      return
    }

    editor.chain().focus().setTextSelection(range.to).run()
  }

  const submitPrompt = async (message: PromptInputMessage) => {
    const trimmedPrompt = message.text.trim()

    if (!trimmedPrompt || isStreamingRef.current) {
      return
    }

    setError(null)
    setIsOpen(false)
    setIsStreaming(true)
    isStreamingRef.current = true
    latestMarkdownRef.current = ""
    abortControllerRef.current = new AbortController()

    try {
      const headers = getApiRequestHeaders({
        "content-type": "application/json",
      })

      if (organizationId) {
        headers.set("x-notelab-organization-id", organizationId)
      }

      const response = await fetch(toApiUrl("/api/ai/editor"), {
        body: JSON.stringify({ prompt: trimmedPrompt }),
        credentials: "include",
        headers,
        method: "POST",
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(await readStreamError(response))
      }

      if (!response.body) {
        throw new Error("The AI response did not include a stream.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        latestMarkdownRef.current += decoder.decode(value, { stream: true })
        replaceGeneratedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      const flushed = decoder.decode()

      if (flushed) {
        latestMarkdownRef.current += flushed
        replaceGeneratedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      finishStreaming()
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        return
      }

      const message =
        streamError instanceof Error
          ? streamError.message
          : "AI generation failed. Try again."

      setError(message)
      toast.error("Ask AI failed", { description: message })
    } finally {
      setIsStreaming(false)
      isStreamingRef.current = false
      abortControllerRef.current = null
      onDone()
    }
  }

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    isStreamingRef.current = false
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen)

        if (!nextOpen) {
          cleanupIfIdle()
        }
      }}
    >
      <PopoverAnchor
        style={{
          height: Math.max(anchorRect.bottom - anchorRect.top, 1),
          left: anchorRect.left,
          position: "fixed",
          top: anchorRect.top,
          width: Math.max(anchorRect.right - anchorRect.left, 1),
        }}
      />
      <PopoverContent
        align="start"
        className="w-[min(42rem,calc(100vw-2rem))] gap-0 p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="bottom"
        sideOffset={8}
      >
        <PromptInput
          className="ask-ai-popover-form"
          inputGroupClassName="h-auto items-stretch overflow-visible border-0 focus-within:border-input focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-0"
          onSubmit={submitPrompt}
        >
          <div className="relative w-full min-w-0 flex-1 self-stretch">
            <PromptInputTextarea
              autoFocus
              className="w-full px-2 focus-visible:border-transparent focus-visible:ring-0"
              disabled={isStreaming}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              placeholder="Ask AI to write in this page..."
              value={prompt}
            />
          </div>
          <PromptInputFooter>
            <PromptInputTools>
              {isStreaming ? (
                <span className="ask-ai-popover-status">Writing...</span>
              ) : error ? (
                <span className="ask-ai-popover-error">{error}</span>
              ) : null}
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!prompt.trim() && !isStreaming}
              onStop={stopStreaming}
              status={isStreaming ? "streaming" : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </PopoverContent>
    </Popover>
  )
}

export function openAskAiPopover({
  editor,
  organizationId,
  range,
}: {
  editor: Editor
  organizationId?: string | null
  range: Range
}) {
  const coords = editor.view.coordsAtPos(range.from)
  const insertPos = range.from
  const container = document.createElement("div")
  let root: Root | null = createRoot(container)
  let didCleanup = false

  const cleanup = () => {
    if (didCleanup) {
      return
    }

    didCleanup = true
    root?.unmount()
    root = null
    container.remove()
    editor.chain().focus().run()
  }

  document.body.appendChild(container)
  editor.chain().focus().deleteRange(range).setTextSelection(insertPos).run()

  root.render(
    <AskAiPopover
      anchorRect={coords}
      editor={editor}
      insertPos={insertPos}
      onDone={cleanup}
      organizationId={organizationId}
    />
  )
}

function AskAiBlockView({ editor, getPos, node }: ReactNodeViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [prompt, setPrompt] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const generatedRangeRef = useRef<GeneratedRange | null>(null)
  const latestMarkdownRef = useRef("")
  const organizationId = editor.extensionManager.extensions.find(
    (extension) => extension.name === "askAiBlock",
  )?.options.organizationId as string | null | undefined

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const readNodePos = () => {
    if (typeof getPos !== "function") {
      return null
    }

    const pos = getPos()

    return typeof pos === "number" ? pos : null
  }

  const removeBlock = () => {
    const pos = readNodePos()

    if (pos === null) {
      return
    }

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run()
  }

  const replaceGeneratedContent = (markdown: string) => {
    const parsed = parseMarkdownContent(editor, markdown)

    if (!parsed) {
      return
    }

    const currentRange = generatedRangeRef.current

    if (currentRange) {
      editor
        .chain()
        .focus()
        .insertContentAt(currentRange, parsed.content, {
          updateSelection: false,
        })
        .run()

      generatedRangeRef.current = {
        from: currentRange.from,
        to: currentRange.from + parsed.size,
      }
      return
    }

    const pos = readNodePos()

    if (pos === null) {
      return
    }

    const insertPos = pos

    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, parsed.content, {
        updateSelection: false,
      })
      .run()

    generatedRangeRef.current = {
      from: insertPos,
      to: insertPos + parsed.size,
    }
  }

  const finishStreaming = () => {
    const pos = readNodePos()
    const range = generatedRangeRef.current

    if (pos === null || !range) {
      removeBlock()
      return
    }

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .setTextSelection(Math.max(pos, range.to - node.nodeSize))
      .run()
  }

  const submitPrompt = async () => {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || isStreaming) {
      return
    }

    setError(null)
    setIsStreaming(true)
    latestMarkdownRef.current = ""
    abortControllerRef.current = new AbortController()

    try {
      const headers = getApiRequestHeaders({
        "content-type": "application/json",
      })

      if (organizationId) {
        headers.set("x-notelab-organization-id", organizationId)
      }

      const response = await fetch(toApiUrl("/api/ai/editor"), {
        body: JSON.stringify({ prompt: trimmedPrompt }),
        credentials: "include",
        headers,
        method: "POST",
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(await readStreamError(response))
      }

      if (!response.body) {
        throw new Error("The AI response did not include a stream.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        latestMarkdownRef.current += decoder.decode(value, { stream: true })
        replaceGeneratedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      const flushed = decoder.decode()

      if (flushed) {
        latestMarkdownRef.current += flushed
        replaceGeneratedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      finishStreaming()
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        return
      }

      const message =
        streamError instanceof Error
          ? streamError.message
          : "AI generation failed. Try again."

      setError(message)
      toast.error("Ask AI failed", { description: message })
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }

  return (
    <NodeViewWrapper className="ask-ai-block" contentEditable={false}>
      <div className="ask-ai-input-shell">
        <Sparkles aria-hidden="true" className="ask-ai-input-icon" />
        <Textarea
          autoFocus
          className="ask-ai-textarea"
          disabled={isStreaming}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submitPrompt()
            }

            if (event.key === "Escape" && !isStreaming) {
              event.preventDefault()
              removeBlock()
            }
          }}
          placeholder="Ask AI to write in this page..."
          rows={1}
          value={prompt}
        />
        {isStreaming ? (
          <Button
            aria-label="Stop generation"
            className="ask-ai-send-button"
            onClick={stopStreaming}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        ) : (
          <Button
            aria-label="Send prompt"
            className="ask-ai-send-button"
            disabled={!prompt.trim()}
            onClick={() => void submitPrompt()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Send />
          </Button>
        )}
      </div>
      {isStreaming ? (
        <div className="ask-ai-status">
          <Loader2 className="animate-spin" />
          <span>Writing...</span>
        </div>
      ) : error ? (
        <div className="ask-ai-error">{error}</div>
      ) : null}
    </NodeViewWrapper>
  )
}

function parseMarkdownContent(
  editor: ReactNodeViewProps["editor"],
  markdown: string,
) {
  const trimmedMarkdown = normalizeUnsupportedMarkdown(markdown).trim()

  if (!trimmedMarkdown) {
    return null
  }

  try {
    const doc = editor.markdown?.parse(trimmedMarkdown)
    const content =
      doc?.content && doc.content.length > 0
        ? sanitizeMarkdownContent(doc.content)
        : [{ type: "paragraph", content: [{ type: "text", text: trimmedMarkdown }] }]
    const size = editor.schema.nodeFromJSON({
      type: "doc",
      content,
    }).content.size

    return { content, size }
  } catch {
    const content: JSONContent[] = [
      {
        type: "paragraph",
        content: [{ type: "text", text: trimmedMarkdown }],
      },
    ]
    const size = editor.schema.nodeFromJSON({ type: "doc", content }).content.size

    return { content, size }
  }
}

function sanitizeMarkdownContent(content: JSONContent[]) {
  return content.map(sanitizeMarkdownNode).filter(Boolean) as JSONContent[]
}

function sanitizeMarkdownNode(node: JSONContent): JSONContent | null {
  if (!node.type) {
    return null
  }

  const content = Array.isArray(node.content)
    ? sanitizeMarkdownContent(node.content)
    : undefined

  if (node.type === "listItem" || node.type === "taskItem") {
    return {
      ...node,
      content: normalizeListItemContent(content),
    }
  }

  if (node.type === "blockquote") {
    return {
      ...node,
      content: normalizeRequiredBlockContent(content),
    }
  }

  if (
    node.type === "bulletList" ||
    node.type === "orderedList" ||
    node.type === "taskList"
  ) {
    return {
      ...node,
      content: normalizeListContent(node.type, content),
    }
  }

  if (content) {
    return { ...node, content }
  }

  return node
}

function normalizeRequiredBlockContent(content: JSONContent[] | undefined) {
  return content && content.length > 0 ? content : [{ type: "paragraph" }]
}

function normalizeListContent(
  listType: string,
  content: JSONContent[] | undefined,
) {
  if (content && content.length > 0) {
    return content
  }

  return [
    {
      type: listType === "taskList" ? "taskItem" : "listItem",
      ...(listType === "taskList" ? { attrs: { checked: false } } : {}),
      content: [{ type: "paragraph" }],
    },
  ]
}

function normalizeListItemContent(content: JSONContent[] | undefined) {
  if (!content || content.length === 0) {
    return [{ type: "paragraph" }]
  }

  const firstNode = content[0]

  if (firstNode?.type === "paragraph") {
    return content
  }

  const leadingInlineNodes: JSONContent[] = []
  let firstBlockIndex = 0

  for (const child of content) {
    if (child.type === "text" || child.marks) {
      leadingInlineNodes.push(child)
      firstBlockIndex += 1
      continue
    }

    break
  }

  return [
    {
      type: "paragraph",
      ...(leadingInlineNodes.length ? { content: leadingInlineNodes } : {}),
    },
    ...content.slice(firstBlockIndex),
  ]
}

function normalizeUnsupportedMarkdown(markdown: string) {
  return normalizeFootnotes(markdown)
}

function normalizeFootnotes(markdown: string) {
  const footnotes = new Map<string, string>()
  const withoutDefinitions = markdown.replace(
    /^[ \t]*\[\^([^\]]+)\]:[ \t]*(.*)(?:\n(?!(?:[ \t]*\[\^[^\]]+\]:|[ \t]*$)).*)*/gm,
    (definition) => {
      const match = /^[ \t]*\[\^([^\]]+)\]:[ \t]*(.*)$/m.exec(definition)

      if (match) {
        footnotes.set(
          match[1],
          definition
            .replace(/^[ \t]*\[\^[^\]]+\]:[ \t]*/m, "")
            .replace(/\n[ \t]+/g, " ")
            .trim(),
        )
      }

      return ""
    },
  )

  const withoutRefs = withoutDefinitions.replace(/\[\^([^\]]+)\]/g, (_ref, id) =>
    footnotes.has(id) ? `[${id}]` : "",
  )
  const unusedFootnotes = Array.from(footnotes.entries()).filter(
    ([, value]) => value.length > 0,
  )

  if (unusedFootnotes.length === 0) {
    return withoutRefs
  }

  return [
    withoutRefs.trimEnd(),
    "",
    "### Notes",
    ...unusedFootnotes.map(([id, value]) => `${id}. ${value}`),
  ].join("\n")
}

async function readStreamError(response: Response) {
  const text = await response.text()

  if (!text) {
    return "AI generation failed. Try again."
  }

  try {
    const body = JSON.parse(text) as { error?: string; message?: string }

    return body.message ?? body.error ?? text
  } catch {
    return text
  }
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export const AskAiBlock = Node.create<AskAiBlockOptions>({
  name: "askAiBlock",

  group: "block",

  atom: true,

  selectable: true,

  addOptions() {
    return {
      organizationId: null,
    }
  },

  parseHTML() {
    return [{ tag: "div[data-type='ask-ai-block']" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "ask-ai-block" }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AskAiBlockView)
  },
})
