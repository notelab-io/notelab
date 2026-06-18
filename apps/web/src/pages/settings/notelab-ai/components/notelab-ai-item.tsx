import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Loader2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getApiErrorMessage } from "@/lib/api"
import { WorkspacePageIcon } from "@/lib/workspace-icon"
import { useNotelabFeatures } from "@notelab/features"
import {
  useUpdateWorkspace,
  workspaceQueryKey,
  type NotelabAiMode,
  type NotelabAiWorkspaceSummary,
  type Workspace,
  type WorkspaceMetadata,
} from "@notelab/features/workspaces"

const modeLabels: Record<NotelabAiMode, string> = {
  instruction: "instruction",
  skill: "skill",
}

export function NotelabAiItem({
  isFirst,
  isLast,
  mode,
  workspace,
  workspaceRecord,
}: {
  isFirst: boolean
  isLast: boolean
  mode: NotelabAiMode
  workspace: NotelabAiWorkspaceSummary
  workspaceRecord?: Workspace
}) {
  const navigate = useNavigate()
  const { apiFetch, queryClient } = useNotelabFeatures()
  const updateWorkspace = useUpdateWorkspace()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const isRemoving = updateWorkspace.isPending

  const openWorkspace = () => {
    void navigate({
      params: { workspaceId: workspace.id },
      to: "/workspace/$workspaceId",
    })
  }

  const remove = async () => {
    let metadata: WorkspaceMetadata = {}

    const cached = queryClient.getQueryData<Workspace | null>(
      workspaceQueryKey(workspace.id),
    )

    if (cached?.metadata) {
      metadata = cached.metadata
    } else {
      const result = await apiFetch<{ workspace: Workspace }>(
        `/workspaces/${workspace.id}`,
        { method: "GET" },
      )
      metadata = result.workspace.metadata ?? {}
    }

    updateWorkspace.mutate(
      {
        id: workspace.id,
        metadata: {
          ...metadata,
          notelabai: null,
        },
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          toast.success(`Removed as ${modeLabels[mode]}.`)
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error))
        },
      },
    )
  }

  return (
    <>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isFirst && "rounded-t-none",
          isLast && "rounded-b-none",
        )}
        onClick={openWorkspace}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openWorkspace()
          }
        }}
        role="link"
        tabIndex={0}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <WorkspacePageIcon
            workspace={
              workspaceRecord ?? {
                content: undefined,
                metadata: workspace.metadata,
              }
            }
          />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {workspace.name || "Untitled"}
        </span>
        <Button
          aria-label={`Remove as ${modeLabels[mode]}`}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          disabled={isRemoving}
          onClick={(event) => {
            event.stopPropagation()
            setConfirmOpen(true)
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {isRemoving ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <XIcon />
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {modeLabels[mode]}</AlertDialogTitle>
            <AlertDialogDescription>
              Remove as {modeLabels[mode]}? This page will become a normal
              workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} variant="destructive">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function NotelabAiItemList({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="divide-y divide-border">{children}</div>
  )
}