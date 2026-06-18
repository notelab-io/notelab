import * as React from "react"
import { BookOpenIcon, WandSparklesIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  NotelabAiMode,
  NotelabAiWorkspaceSummary,
  Workspace,
} from "@notelab/features/workspaces"

import { NotelabAiCreateMenu } from "./notelab-ai-create-menu"
import { NotelabAiItem, NotelabAiItemList } from "./notelab-ai-item"

const sectionConfig: Record<
  NotelabAiMode,
  {
    description: string
    emptyDescription: string
    emptyTitle: string
    icon: React.ReactNode
    title: string
  }
> = {
  instruction: {
    title: "Instructions",
    description: "Pages the AI reads as persistent context.",
    emptyTitle: "No instructions",
    emptyDescription:
      "Create a new instruction or add an existing workspace page.",
    icon: <BookOpenIcon />,
  },
  skill: {
    title: "Skills",
    description: "Pages the AI can invoke as specialized capabilities.",
    emptyTitle: "No skills",
    emptyDescription:
      "Create a new skill or add an existing workspace page.",
    icon: <WandSparklesIcon />,
  },
}

export function NotelabAiSection({
  isLoading,
  items,
  mode,
  organizationId,
  workspacesById,
}: {
  isLoading: boolean
  items: NotelabAiWorkspaceSummary[]
  mode: NotelabAiMode
  organizationId: string | null
  workspacesById: Map<string, Workspace>
}) {
  const config = sectionConfig[mode]
  const existingWorkspaceIds = items.map((workspace) => workspace.id)
  const isEmpty = items.length === 0
  const showList = !isLoading && !isEmpty

  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h3 className="font-heading text-base leading-snug font-medium">
            {config.title}
          </h3>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        {!isLoading ? (
          <NotelabAiCreateMenu
            existingWorkspaceIds={existingWorkspaceIds}
            mode={mode}
            organizationId={organizationId}
          />
        ) : null}
      </div>

      <Card className={cn(showList && "gap-0 overflow-hidden py-0")}>
        <CardContent className={cn(showList && "p-0")}>
          {isLoading ? (
            <NotelabAiSectionSkeleton />
          ) : isEmpty ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">{config.icon}</EmptyMedia>
                <EmptyTitle>{config.emptyTitle}</EmptyTitle>
                <EmptyDescription>{config.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <NotelabAiItemList>
              {items.map((workspace, index) => (
                <NotelabAiItem
                  key={workspace.id}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  mode={mode}
                  workspace={workspace}
                  workspaceRecord={workspacesById.get(workspace.id)}
                />
              ))}
            </NotelabAiItemList>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function NotelabAiSectionSkeleton() {
  return (
    <div className="grid gap-2 py-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton className="h-11" key={index} />
      ))}
    </div>
  )
}