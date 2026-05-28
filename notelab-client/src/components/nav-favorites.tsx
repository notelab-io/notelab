"use client"

import { Link, useLocation } from "@tanstack/react-router"
import type { ReactNode } from "react"
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
  useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, StarOffIcon, LinkIcon, ArrowUpRightIcon } from "lucide-react"

export function NavFavorites({
  favorites,
  onRemoveFavorite,
}: {
  favorites: {
    id: string
    name: string
    emoji: ReactNode
  }[]
  onRemoveFavorite: (workspaceId: string) => void
}) {
  const { isMobile } = useSidebar()
  const activeWorkspaceId = getActiveWorkspaceId(useLocation().pathname)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarMenu>
        {favorites.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={activeWorkspaceId === item.id}>
              <Link
                params={{ workspaceId: item.id }}
                title={item.name}
                to="/workspace/$workspaceId"
              >
                <span>{item.emoji}</span>
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropDrawer>
              <DropDrawerTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="aria-expanded:bg-muted"
                >
                  <MoreHorizontalIcon
                  />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropDrawerTrigger>
              <DropDrawerContent
                className="w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropDrawerItem onSelect={() => onRemoveFavorite(item.id)}>
                  <StarOffIcon className="text-muted-foreground" />
                  <span>Remove from Favorites</span>
                </DropDrawerItem>
                <DropDrawerSeparator />
                <DropDrawerItem
                  onSelect={() => {
                    void navigator.clipboard?.writeText(
                      `${window.location.origin}/workspace/${item.id}`,
                    )
                  }}
                >
                  <LinkIcon className="text-muted-foreground" />
                  <span>Copy Link</span>
                </DropDrawerItem>
                <DropDrawerItem
                  onSelect={() => {
                    window.open(`/workspace/${item.id}`, "_blank", "noopener")
                  }}
                >
                  <ArrowUpRightIcon className="text-muted-foreground" />
                  <span>Open in New Tab</span>
                </DropDrawerItem>
              </DropDrawerContent>
            </DropDrawer>
          </SidebarMenuItem>
        ))}
        {favorites.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/50">
              <span>No favorites</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {favorites.length > 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MoreHorizontalIcon />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function getActiveWorkspaceId(pathname: string) {
  const match = pathname.match(/^\/workspace\/([^/?#]+)/)

  if (!match) {
    return null
  }

  return decodeURIComponent(match[1])
}
