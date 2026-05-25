"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSession } from "@/features/auth/hooks"
import {
  useOrganizations,
  useSetActiveOrganization,
} from "@/features/organizations/hooks"
import { useAppStore } from "@/stores/app-store"
import { Building2Icon, ChevronDownIcon, PlusIcon } from "lucide-react"

export function OrganizationSwitcher() {
  const { data: sessionData } = useSession()
  const { data: organizations = [], isError, isLoading } = useOrganizations()
  const setActiveOrganization = useSetActiveOrganization()
  const storedActiveOrganizationId = useAppStore((state) => state.activeOrganizationId)

  const activeOrganizationId =
    sessionData?.session?.activeOrganizationId ?? storedActiveOrganizationId
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="w-fit max-w-full px-1.5"
              disabled={isLoading || organizations.length === 0}
            >
              <div className="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                {activeOrganization ? (
                  <span className="text-[10px] font-semibold">
                    {getOrganizationInitials(activeOrganization.name)}
                  </span>
                ) : (
                  <Building2Icon className="size-3.5" />
                )}
              </div>
              <span className="truncate font-medium">
                {readTriggerLabel({
                  activeOrganizationName: activeOrganization?.name,
                  isError,
                  isLoading,
                })}
              </span>
              <ChevronDownIcon className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((organization, index) => (
              <DropdownMenuItem
                key={organization.id}
                onClick={() => setActiveOrganization.mutate(organization.id)}
                disabled={
                  organization.id === activeOrganization?.id ||
                  setActiveOrganization.isPending
                }
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-xs border">
                  <span className="text-xs font-medium">
                    {getOrganizationInitials(organization.name)}
                  </span>
                </div>
                <span className="truncate">{organization.name}</span>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" disabled>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <PlusIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Add organization
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function readTriggerLabel({
  activeOrganizationName,
  isError,
  isLoading,
}: {
  activeOrganizationName?: string
  isError: boolean
  isLoading: boolean
}) {
  if (isLoading) {
    return "Loading..."
  }

  if (isError) {
    return "Unable to load"
  }

  return activeOrganizationName ?? "No organizations"
}

function getOrganizationInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

  return initials || "N"
}
