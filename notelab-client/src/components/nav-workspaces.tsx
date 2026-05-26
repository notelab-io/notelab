import { useState, type DragEvent, type ReactNode } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon, PlusIcon, MoreHorizontalIcon } from "lucide-react"
import { DATABASE_PAGE_DRAG_MIME } from "@/packages/editor/extensions/database"

type WorkspaceNavItem = {
  databaseId?: string | null
  id: string
  isTeamspace: boolean
  name: string
  emoji: ReactNode
  pages: WorkspaceNavItem[]
}

type DatabaseDropInput = {
  databaseId: string
  pageId: string
  targetPageId: string
  title?: string
}

export function NavWorkspaces({
  onCreateWorkspace,
  onDropPageOnDatabase,
  privateWorkspaces,
  teamspaceWorkspaces,
}: {
  onCreateWorkspace: () => void
  onDropPageOnDatabase?: (input: DatabaseDropInput) => void
  privateWorkspaces: WorkspaceNavItem[]
  teamspaceWorkspaces: WorkspaceNavItem[]
}) {
  const location = useLocation()
  const [databaseDropTargetId, setDatabaseDropTargetId] = useState<
    string | null
  >(null)

  return (
    <>
      <WorkspaceSection
        databaseDropTargetId={databaseDropTargetId}
        label="Private"
        onCreateWorkspace={onCreateWorkspace}
        onDatabaseDropTargetChange={setDatabaseDropTargetId}
        onDropPageOnDatabase={onDropPageOnDatabase}
        pathname={location.pathname}
        showCreateAction
        workspaces={privateWorkspaces}
      />
      <WorkspaceSection
        databaseDropTargetId={databaseDropTargetId}
        label="Team"
        onDatabaseDropTargetChange={setDatabaseDropTargetId}
        onDropPageOnDatabase={onDropPageOnDatabase}
        pathname={location.pathname}
        workspaces={teamspaceWorkspaces}
      />
    </>
  )
}

function WorkspaceSection({
  databaseDropTargetId,
  label,
  onCreateWorkspace,
  onDatabaseDropTargetChange,
  onDropPageOnDatabase,
  pathname,
  showCreateAction = false,
  workspaces,
}: {
  databaseDropTargetId: string | null
  label: string
  onCreateWorkspace?: () => void
  onDatabaseDropTargetChange: (workspaceId: string | null) => void
  onDropPageOnDatabase?: (input: DatabaseDropInput) => void
  pathname: string
  showCreateAction?: boolean
  workspaces: WorkspaceNavItem[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      {showCreateAction ? (
        <SidebarGroupAction
          aria-label="Create workspace"
          title="Create workspace"
          onClick={onCreateWorkspace}
        >
          <PlusIcon />
        </SidebarGroupAction>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {workspaces.map((workspace) => (
            <WorkspaceTreeItem
              databaseDropTargetId={databaseDropTargetId}
              isRoot
              item={workspace}
              key={workspace.id}
              onDatabaseDropTargetChange={onDatabaseDropTargetChange}
              onDropPageOnDatabase={onDropPageOnDatabase}
              pathname={pathname}
            />
          ))}
          {workspaces.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton className="text-sidebar-foreground/50">
                <span>No workspaces</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {workspaces.length > 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton className="text-sidebar-foreground/70">
                <MoreHorizontalIcon />
                <span>More</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function hasActiveDescendant(item: WorkspaceNavItem, pathname: string): boolean {
  return item.pages.some(
    (page) =>
      pathname === `/workspace/${page.id}` || hasActiveDescendant(page, pathname),
  )
}

function WorkspaceTreeItem({
  databaseDropTargetId,
  isRoot = false,
  item,
  onDatabaseDropTargetChange,
  onDropPageOnDatabase,
  pathname,
}: {
  databaseDropTargetId: string | null
  isRoot?: boolean
  item: WorkspaceNavItem
  onDatabaseDropTargetChange: (workspaceId: string | null) => void
  onDropPageOnDatabase?: (input: DatabaseDropInput) => void
  pathname: string
}) {
  const isActive = pathname === `/workspace/${item.id}`
  const hasPages = item.pages.length > 0
  const isOpen = isActive || hasActiveDescendant(item, pathname)
  const displayName = item.name.trim() || "Untitled"
  const isDatabaseDropTarget = databaseDropTargetId === item.id
  const canDropOnDatabase = Boolean(item.databaseId && onDropPageOnDatabase)
  const startPageDrag = (event: DragEvent<HTMLAnchorElement>) => {
    event.dataTransfer.effectAllowed = "copyMove"
    event.dataTransfer.setData(
      DATABASE_PAGE_DRAG_MIME,
      JSON.stringify({
        pageId: item.id,
        title: displayName,
      })
    )
    event.dataTransfer.setData("text/plain", displayName)
  }
  const handleDatabaseDragOver = (event: DragEvent<HTMLAnchorElement>) => {
    if (!canDropOnDatabase || !hasDraggedPagePayload(event)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    onDatabaseDropTargetChange(item.id)
  }
  const handleDatabaseDragLeave = (event: DragEvent<HTMLAnchorElement>) => {
    if (
      !event.currentTarget.contains(
        event.relatedTarget as globalThis.Node | null
      )
    ) {
      onDatabaseDropTargetChange(null)
    }
  }
  const handleDatabaseDrop = (event: DragEvent<HTMLAnchorElement>) => {
    const dragPayload = getDraggedPagePayload(event)

    if (!canDropOnDatabase || !item.databaseId || !dragPayload) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onDatabaseDropTargetChange(null)
    onDropPageOnDatabase?.({
      databaseId: item.databaseId,
      pageId: dragPayload.pageId,
      targetPageId: item.id,
      title: dragPayload.title,
    })
  }
  const databaseDropProps = {
    className: isDatabaseDropTarget
      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring"
      : undefined,
    onDragEnter: handleDatabaseDragOver,
    onDragLeave: handleDatabaseDragLeave,
    onDragOver: handleDatabaseDragOver,
    onDrop: handleDatabaseDrop,
  }

  if (!isRoot) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link
            draggable
            onDragStart={startPageDrag}
            to="/workspace/$workspaceId"
            params={{ workspaceId: item.id }}
            {...databaseDropProps}
          >
            <span>{item.emoji}</span>
            <span>{displayName}</span>
          </Link>
        </SidebarMenuSubButton>
        {hasPages ? (
          <SidebarMenuSub>
            {item.pages.map((page) => (
              <WorkspaceTreeItem
                databaseDropTargetId={databaseDropTargetId}
                item={page}
                key={page.id}
                onDatabaseDropTargetChange={onDatabaseDropTargetChange}
                onDropPageOnDatabase={onDropPageOnDatabase}
                pathname={pathname}
              />
            ))}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuSubItem>
    )
  }

  return (
    <Collapsible defaultOpen={isOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link
            draggable
            onDragStart={startPageDrag}
            to="/workspace/$workspaceId"
            params={{ workspaceId: item.id }}
            {...databaseDropProps}
          >
            <span>{item.emoji}</span>
            <span>{displayName}</span>
          </Link>
        </SidebarMenuButton>
        {hasPages ? (
          <CollapsibleTrigger asChild>
            <SidebarMenuAction
              className="left-2 bg-sidebar-accent text-sidebar-accent-foreground data-[state=open]:rotate-90"
              showOnHover
            >
              <ChevronRightIcon />
            </SidebarMenuAction>
          </CollapsibleTrigger>
        ) : null}
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.pages.map((page) => (
              <WorkspaceTreeItem
                databaseDropTargetId={databaseDropTargetId}
                item={page}
                key={page.id}
                onDatabaseDropTargetChange={onDatabaseDropTargetChange}
                onDropPageOnDatabase={onDropPageOnDatabase}
                pathname={pathname}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function getDraggedPagePayload(event: DragEvent) {
  const payload = event.dataTransfer.getData(DATABASE_PAGE_DRAG_MIME)

  if (!payload) {
    return null
  }

  try {
    const parsed = JSON.parse(payload) as {
      pageId?: unknown
      title?: unknown
    }

    if (typeof parsed.pageId !== "string" || !parsed.pageId) {
      return null
    }

    return {
      pageId: parsed.pageId,
      title: typeof parsed.title === "string" ? parsed.title : undefined,
    }
  } catch {
    return null
  }
}

function hasDraggedPagePayload(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes(DATABASE_PAGE_DRAG_MIME)
}
