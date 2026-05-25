import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"

import { Spinner } from "@/components/ui/spinner"
import {
  getWorkspaceEmoji,
  type WorkspaceMetadata,
} from "@/features/workspaces/queries"
import {
  useUpdateWorkspace,
  useCreateWorkspace,
  useWorkspace,
} from "@/features/workspaces/hooks"
import { Editor } from "@/packages/editor"

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/app/workspace/$workspaceId" })
  const navigate = useNavigate()
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const createWorkspace = useCreateWorkspace()
  const updateWorkspace = useUpdateWorkspace()
  const contentSaveTimeoutRef = useRef<number | null>(null)
  const pendingContentRef = useRef<unknown>(null)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")

  const flushContentSaveTimeout = useCallback(() => {
    if (contentSaveTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(contentSaveTimeoutRef.current)
    contentSaveTimeoutRef.current = null

    if (workspace && pendingContentRef.current !== null) {
      updateWorkspace.mutate({
        id: workspace.id,
        content: pendingContentRef.current,
      })
      pendingContentRef.current = null
    }
  }, [updateWorkspace, workspace])

  const clearContentSaveTimeout = useCallback(() => {
    if (contentSaveTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(contentSaveTimeoutRef.current)
    contentSaveTimeoutRef.current = null
    pendingContentRef.current = null
  }, [])

  useEffect(() => {
    if (!workspace) {
      return
    }

    setName(workspace.name)
    setEmoji(getWorkspaceEmoji(workspace) ?? "")
  }, [workspace])

  useEffect(() => {
    return flushContentSaveTimeout
  }, [flushContentSaveTimeout, workspaceId])

  useEffect(() => {
    if (!workspace || name.trim() === workspace.name) {
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
      pendingContentRef.current = content

      contentSaveTimeoutRef.current = window.setTimeout(() => {
        updateWorkspace.mutate({ id: workspace.id, content })
        contentSaveTimeoutRef.current = null
        pendingContentRef.current = null
      }, 800)
    },
    [clearContentSaveTimeout, updateWorkspace, workspace],
  )

  const createNestedPage = useCallback(async () => {
    if (!workspace) {
      throw new Error("Workspace is required")
    }

    return createWorkspace.mutateAsync({
      content: "",
      emoji: "",
      name: "",
      organizationId: workspace.organizationId,
      parentWorkspaceId: workspace.id,
    })
  }, [createWorkspace, workspace])

  const openPage = useCallback(
    (pageId: string) => {
      void navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId: pageId },
      })
    },
    [navigate],
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
        onCreatePage={createNestedPage}
        onEmojiChange={updateEmoji}
        onOpenPage={openPage}
        onTitleChange={setName}
        organizationId={workspace.organizationId}
        title={name}
        workspaceId={workspace.id}
      />
    </main>
  )
}
