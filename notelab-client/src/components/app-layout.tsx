import { Link, Outlet, useLocation } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { NavActions } from "@/components/nav-actions"
import { SettingsSidebar } from "@/components/settings-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppLayout() {
  const location = useLocation()
  const isSettingsPage = location.pathname.startsWith("/settings")

  return (
    <SidebarProvider>
      {isSettingsPage ? <SettingsSidebar /> : <AppSidebar />}
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <AppBreadcrumbs pathname={location.pathname} />
          </div>
          {!isSettingsPage && (
            <div className="ml-auto px-3">
              <NavActions />
            </div>
          )}
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppBreadcrumbs({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/settings")) {
    const settingsPageTitle = getSettingsPageTitle(pathname)

    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link to="/settings">Settings</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {settingsPageTitle && (
            <>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  {settingsPageTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="line-clamp-1">Dashboard</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function getSettingsPageTitle(pathname: string) {
  const pathParts = pathname.split("/").filter(Boolean)
  const page = pathParts[1]

  if (!page) {
    return null
  }

  const titles: Record<string, string> = {
    organization: "Organization",
    profile: "Profile",
    team: "Team",
  }

  return titles[page] ?? null
}
