"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function RightSidebarDesktopSlot({
  ariaLabel,
  children,
  open,
}: {
  ariaLabel: string
  children: ReactNode
  open: boolean
}) {
  return (
    <div
      className={cn(
        "relative h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-linear",
        open ? "w-(--right-sidebar-panel-width)" : "w-0",
      )}
    >
      <aside
        aria-hidden={!open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-full w-(--right-sidebar-panel-width) flex-col bg-background text-foreground",
          open ? "border-l border-sidebar-border" : "border-0",
        )}
        inert={open ? undefined : true}
      >
        {children}
      </aside>
    </div>
  )
}

function RightSidebarMobilePanel({
  ariaLabel,
  children,
  open,
  rightOffset = false,
  zIndexClassName = "z-40",
}: {
  ariaLabel: string
  children: ReactNode
  open: boolean
  rightOffset?: boolean
  zIndexClassName?: string
}) {
  return (
    <aside
      aria-hidden={!open}
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-y-0 flex h-svh w-[min(100vw,var(--right-sidebar-panel-width))] flex-col border-l border-sidebar-border bg-background text-foreground transition-[right] duration-200 ease-linear",
        zIndexClassName,
        open
          ? rightOffset
            ? "right-(--right-sidebar-panel-width)"
            : "right-0"
          : "pointer-events-none right-[calc(min(100vw,var(--right-sidebar-panel-width))*-1)]",
      )}
      inert={open ? undefined : true}
    >
      {children}
    </aside>
  )
}

export function RightSidebars({
  chatOpen,
  chatPanel,
  chatTrigger,
  discussionsEnabled,
  discussionsOpen,
  discussionsPanel,
}: {
  chatOpen: boolean
  chatPanel: ReactNode
  chatTrigger?: ReactNode
  discussionsEnabled: boolean
  discussionsOpen: boolean
  discussionsPanel?: ReactNode
}) {
  const openPanelCount =
    (chatOpen ? 1 : 0) + (discussionsEnabled && discussionsOpen ? 1 : 0)

  return (
    <>
      {chatTrigger}
      <div
        className="relative shrink-0"
        data-state={openPanelCount > 0 ? "expanded" : "collapsed"}
      >
        <div
          aria-hidden
          className={cn(
            "relative hidden bg-transparent transition-[width] duration-200 ease-linear md:block",
            openPanelCount === 0 && "w-0",
            openPanelCount === 1 && "w-(--right-sidebar-panel-width)",
            openPanelCount === 2 &&
              "w-[calc(2*var(--right-sidebar-panel-width))]",
          )}
        />

        <div className="absolute inset-y-0 right-0 hidden h-svh md:flex">
          {discussionsEnabled && discussionsPanel ? (
            <RightSidebarDesktopSlot
              ariaLabel="Discussions sidebar"
              open={discussionsOpen}
            >
              {discussionsPanel}
            </RightSidebarDesktopSlot>
          ) : null}
          <RightSidebarDesktopSlot ariaLabel="Chat sidebar" open={chatOpen}>
            {chatPanel}
          </RightSidebarDesktopSlot>
        </div>

        <div className="md:hidden">
          {discussionsEnabled && discussionsPanel ? (
            <RightSidebarMobilePanel
              ariaLabel="Discussions sidebar"
              open={discussionsOpen}
              rightOffset={chatOpen}
            >
              {discussionsPanel}
            </RightSidebarMobilePanel>
          ) : null}
          <RightSidebarMobilePanel
            ariaLabel="Chat sidebar"
            open={chatOpen}
            zIndexClassName="z-50"
          >
            {chatPanel}
          </RightSidebarMobilePanel>
        </div>
      </div>
    </>
  )
}