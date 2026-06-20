import type { Editor, Range } from "@tiptap/core"
import { Loader2, Sparkles } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  nextPaint,
  parseMarkdownContent,
  readStreamError,
  type GeneratedRange,
} from "@/packages/editor/editor-ai-utils"
import { getApiRequestHeaders, toApiUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useNotelabAiWorkspaces } from "@notelab/features/workspaces"

type SelectionAiMenuProps = {
  editor: Editor
  organizationId?: string | null
}

export function SelectionAiMenu({
  editor,
  organizationId,
}: SelectionAiMenuProps) {
  const { data: aiWorkspaces = [], isLoading } =
    useNotelabAiWorkspaces(organizationId)
  const skills = React.useMemo(
    () =>
      aiWorkspaces.filter(
        (workspace) => workspace.metadata.notelabai === "skill",
      ),
    [aiWorkspaces],
  )
  const [isOpen, setIsOpen] = React.useState(false)
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [prompt, setPrompt] = React.useState("")
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(
    null,
  )
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const generatedRangeRef = React.useRef<GeneratedRange | null>(null)
  const latestMarkdownRef = React.useRef("")
  const selectedRangeRef = React.useRef<Range | null>(null)
  const selectedTextRef = React.useRef("")

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const selectedSkill = React.useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills],
  )

  const captureSelection = () => {
    const { from, to } = editor.state.selection

    if (from === to) {
      selectedRangeRef.current = null
      selectedTextRef.current = ""
      return
    }

    selectedRangeRef.current = { from, to }
    selectedTextRef.current = editor.state.doc.textBetween(from, to, "\n\n", "\n")
  }

  const replaceSelectedContent = (markdown: string) => {
    const parsed = parseMarkdownContent(editor, markdown, {
      unwrapPlainFencedBlock: true,
    })

    if (!parsed) {
      return
    }

    const currentRange =
      generatedRangeRef.current ?? selectedRangeRef.current

    if (!currentRange) {
      return
    }

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
  }

  const finishStreaming = () => {
    const range = generatedRangeRef.current ?? selectedRangeRef.current

    if (range) {
      editor.chain().focus().setTextSelection(range.to).run()
      return
    }

    editor.chain().focus().run()
  }

  const submitPrompt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedPrompt = prompt.trim()
    const selectedRange = selectedRangeRef.current

    if (!trimmedPrompt || !selectedRange || isStreaming) {
      return
    }

    setIsStreaming(true)
    latestMarkdownRef.current = ""
    generatedRangeRef.current = null
    abortControllerRef.current = new AbortController()

    try {
      const headers = getApiRequestHeaders({
        "content-type": "application/json",
      })

      if (organizationId) {
        headers.set("x-notelab-organization-id", organizationId)
      }

      const response = await fetch(toApiUrl("/api/ai/editor"), {
        body: JSON.stringify({
          prompt: trimmedPrompt,
          selectedText: selectedTextRef.current,
          skillWorkspaceId: selectedSkill?.id,
        }),
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

      setIsOpen(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        latestMarkdownRef.current += decoder.decode(value, { stream: true })
        replaceSelectedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      const flushed = decoder.decode()

      if (flushed) {
        latestMarkdownRef.current += flushed
        replaceSelectedContent(latestMarkdownRef.current)
        await nextPaint()
      }

      finishStreaming()
      setPrompt("")
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        return
      }

      const message =
        streamError instanceof Error
          ? streamError.message
          : "AI generation failed. Try again."

      toast.error("Selection AI failed", { description: message })
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          captureSelection()
        }

        setIsOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label="Ask AI"
          disabled={isStreaming}
          onMouseDown={(event) => event.preventDefault()}
          size="icon"
          title="Ask AI"
          type="button"
          variant="ghost"
        >
          {isStreaming ? <Loader2 className="animate-spin" /> : <Sparkles />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="selection-ai-menu"
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="bottom"
        sideOffset={8}
      >
        <div className="selection-ai-skills" role="listbox">
          <button
            className={cn(
              "selection-ai-skill",
              !selectedSkillId && "selection-ai-skill-active",
            )}
            onClick={() => setSelectedSkillId(null)}
            type="button"
          >
            General
          </button>
          {skills.map((skill) => (
            <button
              className={cn(
                "selection-ai-skill",
                selectedSkillId === skill.id && "selection-ai-skill-active",
              )}
              key={skill.id}
              onClick={() => setSelectedSkillId(skill.id)}
              title={skill.name}
              type="button"
            >
              {skill.metadata.emoji ? (
                <span className="selection-ai-skill-emoji">
                  {skill.metadata.emoji}
                </span>
              ) : null}
              <span className="truncate">{skill.name || "Untitled skill"}</span>
            </button>
          ))}
          {isLoading ? (
            <div className="selection-ai-empty">Loading skills...</div>
          ) : skills.length === 0 ? (
            <div className="selection-ai-empty">No skills yet</div>
          ) : null}
        </div>
        <form className="selection-ai-form" onSubmit={submitPrompt}>
          <Input
            autoFocus
            disabled={isStreaming}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder={
              selectedSkill
                ? `Ask ${selectedSkill.name || "this skill"}...`
                : "Ask AI to rewrite the selection..."
            }
            value={prompt}
          />
        </form>
      </PopoverContent>
    </Popover>
  )
}
