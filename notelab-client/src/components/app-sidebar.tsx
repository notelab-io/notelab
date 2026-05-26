"use client"

import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { NavFavorites } from "@/components/nav-favorites"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavWorkspaces } from "@/components/nav-workspaces"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import { ThemeDropdown } from "@/components/theme-dropdown"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSession } from "@/features/auth/hooks"
import { useOrganizations } from "@/features/organizations/hooks"
import { useAddDatabaseRow } from "@/features/databases/hooks"
import {
  getWorkspaceEmoji,
  type Workspace,
} from "@/features/workspaces/queries"
import {
  useCreateWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks"
import { useAppStore } from "@/stores/app-store"
import { SearchIcon, SparklesIcon, HomeIcon, InboxIcon, CalendarIcon, Settings2Icon, BlocksIcon, Trash2Icon, MessageCircleQuestionIcon } from "lucide-react"

type WorkspaceTreeNode = {
  databaseId?: string | null
  id: string
  isTeamspace: boolean
  name: string
  emoji: React.ReactNode
  pages: WorkspaceTreeNode[]
}

// This is sample data.
const data = {
  navMain: [
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
    {
      title: "Ask AI",
      url: "#",
      icon: (
        <SparklesIcon
        />
      ),
    },
    {
      title: "Home",
      url: "#",
      icon: (
        <HomeIcon
        />
      ),
      isActive: true,
    },
    {
      title: "Inbox",
      url: "#",
      icon: (
        <InboxIcon
        />
      ),
      badge: "10",
    },
  ],
  navSecondary: [
    {
      title: "Calendar",
      url: "#",
      icon: (
        <CalendarIcon
        />
      ),
    },
    {
      title: "Settings",
      url: "/settings/profile",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Templates",
      url: "#",
      icon: (
        <BlocksIcon
        />
      ),
    },
    {
      title: "Trash",
      url: "#",
      icon: (
        <Trash2Icon
        />
      ),
    },
    {
      title: "Help",
      url: "#",
      icon: (
        <MessageCircleQuestionIcon
        />
      ),
    },
  ],
  favorites: [
    {
      name: "Project Management & Task Tracking",
      url: "#",
      emoji: "📊",
    },
    {
      name: "Family Recipe Collection & Meal Planning",
      url: "#",
      emoji: "🍳",
    },
    {
      name: "Fitness Tracker & Workout Routines",
      url: "#",
      emoji: "💪",
    },
    {
      name: "Book Notes & Reading List",
      url: "#",
      emoji: "📚",
    },
    {
      name: "Sustainable Gardening Tips & Plant Care",
      url: "#",
      emoji: "🌱",
    },
    {
      name: "Language Learning Progress & Resources",
      url: "#",
      emoji: "🗣️",
    },
    {
      name: "Home Renovation Ideas & Budget Tracker",
      url: "#",
      emoji: "🏠",
    },
    {
      name: "Personal Finance & Investment Portfolio",
      url: "#",
      emoji: "💰",
    },
    {
      name: "Movie & TV Show Watchlist with Reviews",
      url: "#",
      emoji: "🎬",
    },
    {
      name: "Daily Habit Tracker & Goal Setting",
      url: "#",
      emoji: "✅",
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const activeOrganizationId = useAppStore((state) => state.activeOrganizationId)
  const { data: session } = useSession()
  const { data: organizations = [] } = useOrganizations()
  const organizationId =
    activeOrganizationId ??
    session?.session?.activeOrganizationId ??
    organizations[0]?.id ??
    null
  const { data: workspaceRecords = [] } = useWorkspaces(organizationId)
  const createWorkspace = useCreateWorkspace()
  const addDatabaseRow = useAddDatabaseRow(organizationId)
  const workspaceSections = buildWorkspaceTreeSections(workspaceRecords)

  const handleCreateWorkspace = async () => {
    if (!organizationId || createWorkspace.isPending) {
      return
    }

    const workspace = await createWorkspace.mutateAsync({ organizationId })

    await navigate({
      to: "/workspace/$workspaceId",
      params: { workspaceId: workspace.id },
    })
  }

  const handleDropPageOnDatabase = ({
    databaseId,
    pageId,
    targetPageId,
    title,
  }: {
    databaseId: string
    pageId: string
    targetPageId: string
    title?: string
  }) => {
    if (pageId === targetPageId) {
      toast.error("You can't nest a page inside itself.")
      return
    }

    if (addDatabaseRow.isPending) {
      return
    }

    addDatabaseRow.mutate(
      {
        databaseId,
        pageId,
        title,
      },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Could not move page."
          )
        },
      }
    )
  }

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
        <NavMain items={data.navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={data.favorites} />
        <NavWorkspaces
          onCreateWorkspace={handleCreateWorkspace}
          onDropPageOnDatabase={handleDropPageOnDatabase}
          privateWorkspaces={workspaceSections.privateWorkspaces}
          teamspaceWorkspaces={workspaceSections.teamspaceWorkspaces}
        />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <ThemeDropdown />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function buildWorkspaceTreeSections(workspaces: Workspace[]) {
  const orderedWorkspaces = [...workspaces].sort(
    (first, second) =>
      getWorkspaceCreatedTime(first) - getWorkspaceCreatedTime(second),
  )
  const nodesById = new Map(
    orderedWorkspaces.map((workspace) => [
      workspace.id,
      {
        databaseId: getWorkspaceDatabaseId(workspace),
        id: workspace.id,
        isTeamspace: Boolean(workspace.isTeamspace),
        name: workspace.name,
        emoji: getWorkspaceEmoji(workspace),
        pages: [] as WorkspaceTreeNode[],
      },
    ]),
  )
  const roots: WorkspaceTreeNode[] = []

  for (const workspace of orderedWorkspaces) {
    const node = nodesById.get(workspace.id)

    if (!node) {
      continue
    }

    const parentWorkspaceId = workspace.metadata?.parentWorkspaceId
    const parent = parentWorkspaceId ? nodesById.get(parentWorkspaceId) : null

    if (parent && parent.id !== node.id) {
      parent.pages.push(node)
    } else {
      roots.push(node)
    }
  }

  return {
    privateWorkspaces: roots.filter((workspace) => !workspace.isTeamspace),
    teamspaceWorkspaces: roots.filter((workspace) => workspace.isTeamspace),
  }
}

function getWorkspaceCreatedTime(workspace: Workspace) {
  const time = new Date(workspace.createdAt).getTime()

  return Number.isFinite(time) ? time : 0
}

function getWorkspaceDatabaseId(workspace: Workspace) {
  return findDatabaseBlockId(workspace.content)
}

function findDatabaseBlockId(content: unknown): string | null {
  if (typeof content === "string") {
    const match = content.match(/data-database-id=["']([^"']+)["']/)

    return match?.[1] ?? null
  }

  if (!content || typeof content !== "object") {
    return null
  }

  if (Array.isArray(content)) {
    for (const child of content) {
      const databaseId = findDatabaseBlockId(child)

      if (databaseId) {
        return databaseId
      }
    }

    return null
  }

  const node = content as {
    attrs?: { databaseId?: unknown }
    content?: unknown
    type?: unknown
  }

  if (
    node.type === "databaseBlock" &&
    typeof node.attrs?.databaseId === "string"
  ) {
    return node.attrs.databaseId
  }

  return findDatabaseBlockId(node.content)
}
