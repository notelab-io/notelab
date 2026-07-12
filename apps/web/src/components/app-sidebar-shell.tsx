"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppSidebarShell({
  children,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" className="overflow-hidden" {...props}>
      {children}
    </Sidebar>
  )
}

export function AppSidebarHeader({ children }: { children: React.ReactNode }) {
  return (
    <SidebarHeader>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        <SidebarTrigger className="shrink-0" />
      </div>
    </SidebarHeader>
  )
}
