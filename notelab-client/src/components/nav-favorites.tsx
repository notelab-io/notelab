"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  LinkIcon,
  MoreHorizontalIcon,
  StarOffIcon,
} from "lucide-react"

import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerSeparator,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { WorkspaceNavItem } from "@/components/nav-workspaces"

export function NavFavorites({
  favorites,
  onRemoveDatabaseFavorite,
  onRemoveFavorite,
}: {
  favorites: WorkspaceNavItem[]
  onRemoveDatabaseFavorite: (databaseId: string) => void
  onRemoveFavorite: (workspaceId: string) => void
}) {
  const location = useLocation()
  const activeWorkspaceId = getActiveWorkspaceId(location.pathname)
  const activeDatabaseId = getActiveDatabaseId(location.pathname)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarMenu>
        {favorites.map((item) => (
          <FavoriteTreeItem
            activeDatabaseId={activeDatabaseId}
            activeWorkspaceId={activeWorkspaceId}
            isRoot
            item={item}
            key={item.id}
            onRemoveDatabaseFavorite={onRemoveDatabaseFavorite}
            onRemoveFavorite={onRemoveFavorite}
          />
        ))}
        {favorites.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/50">
              <span>No favorites</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function FavoriteTreeItem({
  activeDatabaseId,
  activeWorkspaceId,
  isRoot = false,
  item,
  onRemoveDatabaseFavorite,
  onRemoveFavorite,
}: {
  activeDatabaseId: string | null
  activeWorkspaceId: string | null
  isRoot?: boolean
  item: WorkspaceNavItem
  onRemoveDatabaseFavorite: (databaseId: string) => void
  onRemoveFavorite: (workspaceId: string) => void
}) {
  const isActive = item.isDatabase
    ? activeDatabaseId === item.databaseId
    : activeWorkspaceId === item.id
  const hasPages = item.pages.length > 0
  const isOpen =
    isActive || hasActiveDescendant(item, activeDatabaseId, activeWorkspaceId)
  const displayName = item.name.trim() || "Untitled"
  const linkWorkspaceId = item.workspaceId

  if (!isRoot) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          {item.isDatabase && item.databaseId ? (
            <Link
              params={{ databaseId: item.databaseId }}
              title={displayName}
              to="/database/$databaseId"
            >
              <span>{item.emoji}</span>
              <span>{displayName}</span>
              {item.isLinked ? (
                <ArrowUpRightIcon
                  aria-label="Linked from another parent"
                  className="ml-auto size-3 text-sidebar-foreground/45"
                />
              ) : null}
            </Link>
          ) : (
            <Link
              params={{ workspaceId: linkWorkspaceId }}
              title={displayName}
              to="/workspace/$workspaceId"
            >
              <span>{item.emoji}</span>
              <span>{displayName}</span>
              {item.isLinked ? (
                <ArrowUpRightIcon
                  aria-label="Linked from another parent"
                  className="ml-auto size-3 text-sidebar-foreground/45"
                />
              ) : null}
            </Link>
          )}
        </SidebarMenuSubButton>
        <FavoriteItemMenu
          item={item}
          onRemoveDatabaseFavorite={onRemoveDatabaseFavorite}
          onRemoveFavorite={onRemoveFavorite}
        />
        {hasPages ? (
          <SidebarMenuSub>
            {item.pages.map((page) => (
              <FavoriteTreeItem
                activeDatabaseId={activeDatabaseId}
                activeWorkspaceId={activeWorkspaceId}
                item={page}
                key={page.id}
                onRemoveDatabaseFavorite={onRemoveDatabaseFavorite}
                onRemoveFavorite={onRemoveFavorite}
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
          {item.isDatabase && item.databaseId ? (
            <Link
              params={{ databaseId: item.databaseId }}
              title={displayName}
              to="/database/$databaseId"
            >
              <span>{item.emoji}</span>
              <span>{displayName}</span>
              {item.isLinked ? (
                <ArrowUpRightIcon
                  aria-label="Linked from another parent"
                  className="ml-auto size-3 text-sidebar-foreground/45"
                />
              ) : null}
            </Link>
          ) : (
            <Link
              params={{ workspaceId: linkWorkspaceId }}
              title={displayName}
              to="/workspace/$workspaceId"
            >
              <span>{item.emoji}</span>
              <span>{displayName}</span>
              {item.isLinked ? (
                <ArrowUpRightIcon
                  aria-label="Linked from another parent"
                  className="ml-auto size-3 text-sidebar-foreground/45"
                />
              ) : null}
            </Link>
          )}
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
        <FavoriteItemMenu
          item={item}
          onRemoveDatabaseFavorite={onRemoveDatabaseFavorite}
          onRemoveFavorite={onRemoveFavorite}
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.pages.map((page) => (
              <FavoriteTreeItem
                activeDatabaseId={activeDatabaseId}
                activeWorkspaceId={activeWorkspaceId}
                item={page}
                key={page.id}
                onRemoveDatabaseFavorite={onRemoveDatabaseFavorite}
                onRemoveFavorite={onRemoveFavorite}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function FavoriteItemMenu({
  item,
  onRemoveDatabaseFavorite,
  onRemoveFavorite,
}: {
  item: WorkspaceNavItem
  onRemoveDatabaseFavorite: (databaseId: string) => void
  onRemoveFavorite: (workspaceId: string) => void
}) {
  const { isMobile } = useSidebar()
  const linkPath =
    item.isDatabase && item.databaseId
      ? `/database/${item.databaseId}`
      : `/workspace/${item.workspaceId}`

  return (
    <DropDrawer>
      <DropDrawerTrigger asChild>
        <SidebarMenuAction showOnHover className="aria-expanded:bg-muted">
          <MoreHorizontalIcon />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropDrawerTrigger>
      <DropDrawerContent
        align={isMobile ? "end" : "start"}
        className="w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
      >
        <DropDrawerItem
          onSelect={() => {
            if (item.isDatabase && item.databaseId) {
              onRemoveDatabaseFavorite(item.databaseId)
              return
            }

            onRemoveFavorite(item.workspaceId)
          }}
        >
          <StarOffIcon className="text-muted-foreground" />
          <span>Remove from Favorites</span>
        </DropDrawerItem>
        <DropDrawerSeparator />
        <DropDrawerItem
          onSelect={() => {
            void navigator.clipboard?.writeText(
              `${window.location.origin}${linkPath}`,
            )
          }}
        >
          <LinkIcon className="text-muted-foreground" />
          <span>Copy Link</span>
        </DropDrawerItem>
        <DropDrawerItem
          onSelect={() => {
            window.open(linkPath, "_blank", "noopener")
          }}
        >
          <ArrowUpRightIcon className="text-muted-foreground" />
          <span>Open in New Tab</span>
        </DropDrawerItem>
      </DropDrawerContent>
    </DropDrawer>
  )
}

function hasActiveDescendant(
  item: WorkspaceNavItem,
  activeDatabaseId: string | null,
  activeWorkspaceId: string | null,
): boolean {
  return item.pages.some(
    (page) =>
      (page.isDatabase
        ? activeDatabaseId === page.databaseId
        : activeWorkspaceId === page.id) ||
      hasActiveDescendant(page, activeDatabaseId, activeWorkspaceId),
  )
}

function getActiveWorkspaceId(pathname: string) {
  const match = pathname.match(/^\/workspace\/([^/?#]+)/)

  if (!match) {
    return null
  }

  return decodeURIComponent(match[1])
}

function getActiveDatabaseId(pathname: string) {
  const match = pathname.match(/^\/database\/([^/?#]+)/)

  if (!match) {
    return null
  }

  return decodeURIComponent(match[1])
}
