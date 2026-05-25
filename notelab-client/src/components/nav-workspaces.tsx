import type { ReactNode } from "react"
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

type WorkspaceNavItem = {
  id: string
  name: string
  emoji: ReactNode
  pages: WorkspaceNavItem[]
}

export function NavWorkspaces({
  onCreateWorkspace,
  workspaces,
}: {
  onCreateWorkspace: () => void
  workspaces: WorkspaceNavItem[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
      <SidebarGroupAction
        aria-label="Create workspace"
        title="Create workspace"
        onClick={onCreateWorkspace}
      >
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {workspaces.map((workspace) => (
            <WorkspaceTreeItem
              isRoot
              item={workspace}
              key={workspace.id}
              pathname={location.pathname}
            />
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MoreHorizontalIcon
              />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
  isRoot = false,
  item,
  pathname,
}: {
  isRoot?: boolean
  item: WorkspaceNavItem
  pathname: string
}) {
  const isActive = pathname === `/workspace/${item.id}`
  const hasPages = item.pages.length > 0
  const isOpen = isActive || hasActiveDescendant(item, pathname)
  const displayName = item.name.trim() || "Untitled"

  if (!isRoot) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link to="/workspace/$workspaceId" params={{ workspaceId: item.id }}>
            <span>{item.emoji}</span>
            <span>{displayName}</span>
          </Link>
        </SidebarMenuSubButton>
        {hasPages ? (
          <SidebarMenuSub>
            {item.pages.map((page) => (
              <WorkspaceTreeItem
                item={page}
                key={page.id}
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
          <Link to="/workspace/$workspaceId" params={{ workspaceId: item.id }}>
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
                item={page}
                key={page.id}
                pathname={pathname}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
