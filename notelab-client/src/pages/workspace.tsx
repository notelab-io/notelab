import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "@tanstack/react-router"

import { Spinner } from "@/components/ui/spinner"
import {
  getWorkspaceEmoji,
  type WorkspaceMetadata,
} from "@/features/workspaces/queries"
import {
  useUpdateWorkspace,
  useWorkspace,
} from "@/features/workspaces/hooks"
import { Editor } from "@/packages/editor"

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/app/workspace/$workspaceId" })
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace()
  const contentSaveTimeoutRef = useRef<number | null>(null)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")

  const clearContentSaveTimeout = useCallback(() => {
    if (contentSaveTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(contentSaveTimeoutRef.current)
    contentSaveTimeoutRef.current = null
  }, [])

  useEffect(() => {
    if (!workspace) {
      return
    }

    setName(workspace.name)
    setEmoji(getWorkspaceEmoji(workspace) ?? "")
  }, [workspace])

  useEffect(() => {
    return clearContentSaveTimeout
  }, [clearContentSaveTimeout, workspaceId])

  useEffect(() => {
    if (!workspace || name.trim() === "" || name === workspace.name) {
      return
    }

    const timeout = window.setTimeout(() => {
      updateWorkspace.mutate({ id: workspace.id, name: name.trim() })
    }, 600)

    return () => window.clearTimeout(timeout)
  }, [name, updateWorkspace, workspace])

  const updateEmoji = (nextEmoji: string) => {
    setEmoji(nextEmoji)

    if (!workspace) {
      return
    }

    updateWorkspace.mutate({
      id: workspace.id,
      metadata: {
        ...((workspace.metadata ?? {}) as WorkspaceMetadata),
        emoji: nextEmoji,
      },
    })
  }

  const updateContent = useCallback(
    (content: unknown) => {
      if (!workspace) {
        return
      }

      clearContentSaveTimeout()

      contentSaveTimeoutRef.current = window.setTimeout(() => {
        updateWorkspace.mutate({ id: workspace.id, content })
        contentSaveTimeoutRef.current = null
      }, 800)
    },
    [clearContentSaveTimeout, updateWorkspace, workspace],
  )

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        Workspace not found.
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col">
      <Editor
        key={workspace.id}
        content={workspace.content ?? ""}
        emoji={emoji}
        onContentChange={updateContent}
        onEmojiChange={updateEmoji}
        onTitleChange={setName}
        title={name}
      />
    </main>
  )
}
