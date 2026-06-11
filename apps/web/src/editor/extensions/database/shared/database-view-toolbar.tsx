import { Link } from "@tanstack/react-router"
import {
  ArrowDownUp,
  Kanban,
  Loader2,
  Maximize2,
  Plus,
  Table2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { DatabaseSearchableMenuItems } from "./database-searchable-menu-items"
import { DatabaseSortPopover } from "./database-sort-menu"
import { useDatabaseViewContext } from "./database-view-context"
import { DatabaseViewSettingsMenu } from "./database-view-settings-menu"

export function DatabaseViewToolbar() {
  const {
    activeDatabaseSorts,
    activeView,
    activeVisibilityConfig,
    addableSortFieldOptions,
    addDatabaseRow,
    addDatabaseView,
    addKanbanView,
    addProperty,
    addRow,
    addTableView,
    canAddDatabaseSort,
    clearDatabaseSort,
    copyDatabaseViewLink,
    createDatabaseSort,
    databaseId,
    draftDatabaseTitle,
    draftViewTitle,
    editable,
    titlePropertyLabel,
    organizationId,
    payload,
    properties,
    removeDatabaseSort,
    saveDatabaseTitle,
    saveDatabaseViewTitle,
    setActiveViewId,
    setDraftDatabaseTitle,
    setDraftViewTitle,
    setSortPickerOpen,
    showExpandButton,
    showSortPill,
    showTitle,
    sortFieldOptions,
    sortPickerOpen,
    togglePropertyVisibility,
    toggleSortPillVisibility,
    updateDatabaseSort,
    visiblePropertyCount,
  } = useDatabaseViewContext()

  return (
    <div className="database-toolbar">
      {showTitle ? (
        <Input
          aria-label="Database title"
          className="database-title-input h-auto min-w-0 w-full rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-semibold leading-tight text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:border-transparent focus-visible:ring-0 md:text-2xl dark:bg-transparent"
          disabled={!databaseId}
          onBlur={(event) => saveDatabaseTitle(event.target.value)}
          onChange={(event) => {
            setDraftDatabaseTitle(event.target.value)
          }}
          placeholder="New database"
          value={draftDatabaseTitle}
        />
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            {(payload?.views ?? []).map(
              (view: { id: string; name: string; type: string }) => {
              const isActiveView = view.id === activeView?.id
              const ViewIcon = view.type === "kanban" ? Kanban : Table2

              return (
                <button
                  aria-pressed={isActiveView}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium transition-colors",
                    isActiveView
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  key={view.id}
                  onClick={() => setActiveViewId(view.id)}
                  type="button"
                >
                  <ViewIcon className="mr-2 size-4 shrink-0" />
                  <span className="truncate">
                    {isActiveView ? draftViewTitle : view.name}
                  </span>
                </button>
              )
              }
            )}
            <DropDrawer>
              <DropDrawerTrigger asChild>
                <Button
                  aria-label="Add database view"
                  className="h-8 w-8 shrink-0 rounded-full"
                  disabled={!databaseId || addDatabaseView.isPending}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  {addDatabaseView.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </DropDrawerTrigger>
              <DropDrawerContent align="start" className="w-40">
                <DropDrawerItem
                  disabled={!databaseId || addDatabaseView.isPending}
                  onSelect={addTableView}
                >
                  <Table2 className="size-4" />
                  <span>Table</span>
                </DropDrawerItem>
                <DropDrawerItem
                  disabled={
                    !databaseId ||
                    addDatabaseView.isPending ||
                    addProperty.isPending
                  }
                  onSelect={addKanbanView}
                >
                  <Kanban className="size-4" />
                  <span>Kanban</span>
                </DropDrawerItem>
              </DropDrawerContent>
            </DropDrawer>
          </div>
          {activeDatabaseSorts.length > 0 && showSortPill ? (
            <div className="mt-2 flex min-w-0 items-center gap-2 overflow-x-auto">
              <DatabaseSortPopover
                activeDatabaseSorts={activeDatabaseSorts}
                addableSortFieldOptions={addableSortFieldOptions}
                canAddDatabaseSort={canAddDatabaseSort}
                onClearDatabaseSort={clearDatabaseSort}
                onCreateDatabaseSort={createDatabaseSort}
                onRemoveDatabaseSort={removeDatabaseSort}
                onUpdateDatabaseSort={updateDatabaseSort}
                sortFieldOptions={sortFieldOptions}
              >
                <Button
                  aria-label="Open sort options"
                  className="group h-8 shrink-0 rounded-full px-3"
                  type="button"
                  variant="secondary"
                >
                  <ArrowDownUp className="size-4 self-center shrink-0" />
                  <span className="self-center truncate">
                    {activeDatabaseSorts.length === 0
                      ? "Sort"
                      : `${activeDatabaseSorts.length} sort${
                          activeDatabaseSorts.length === 1 ? "" : "s"
                        }`}
                  </span>
                </Button>
              </DatabaseSortPopover>
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {editable ? (
            <>
              {activeDatabaseSorts.length === 0 ? (
                <DropDrawer
                  open={sortPickerOpen}
                  onOpenChange={setSortPickerOpen}
                >
                  <DropDrawerTrigger asChild>
                    <Button
                      aria-label="Add sort"
                      className="text-muted-foreground"
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDownUp />
                    </Button>
                  </DropDrawerTrigger>
                  <DropDrawerContent
                    align="start"
                    className="w-72"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                  >
                    <DatabaseSearchableMenuItems
                      inputAriaLabel="Sort properties"
                      inputIcon={<ArrowDownUp className="size-4" />}
                      inputPlaceholder="Sort by..."
                      onSelect={createDatabaseSort}
                      open={sortPickerOpen}
                      options={sortFieldOptions}
                    />
                  </DropDrawerContent>
                </DropDrawer>
              ) : (
                <Button
                  aria-label={showSortPill ? "Hide sort pill" : "Show sort pill"}
                  className={
                    showSortPill ? "text-foreground" : "text-muted-foreground"
                  }
                  onClick={toggleSortPillVisibility}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDownUp />
                </Button>
              )}
              <DatabaseViewSettingsMenu
                activeDatabaseSorts={activeDatabaseSorts}
                activeViewType={activeView?.type}
                databaseId={databaseId ?? undefined}
                databaseName={draftDatabaseTitle}
                dataSources={
                  payload?.database.id
                    ? [
                        {
                          id: payload.database.id,
                          name: draftDatabaseTitle || payload.database.name,
                          viewCount: payload.views.length,
                        },
                      ]
                    : []
                }
                draftViewTitle={draftViewTitle}
                titlePropertyLabel={titlePropertyLabel}
                organizationId={
                  payload?.database.organizationId ?? organizationId ?? undefined
                }
                onCopyDatabaseViewLink={copyDatabaseViewLink}
                onClearDatabaseSort={clearDatabaseSort}
                onCreateDatabaseSort={createDatabaseSort}
                onDraftViewTitleChange={setDraftViewTitle}
                onRemoveDatabaseSort={removeDatabaseSort}
                onSaveDatabaseViewTitle={saveDatabaseViewTitle}
                onTogglePropertyVisibility={togglePropertyVisibility}
                onUpdateDatabaseSort={updateDatabaseSort}
                properties={properties}
                sortFieldOptions={sortFieldOptions}
                addableSortFieldOptions={addableSortFieldOptions}
                canAddDatabaseSort={canAddDatabaseSort}
                viewConfig={activeVisibilityConfig}
                visiblePropertyCount={visiblePropertyCount}
              />
              <Button
                className="database-new-button"
                disabled={!databaseId || addRow.isPending}
                onClick={() => addDatabaseRow()}
                type="button"
              >
                {addRow.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                <span>New</span>
              </Button>
            </>
          ) : null}
          {showExpandButton && databaseId ? (
            <Button
              aria-label="Expand database"
              asChild
              className="database-expand-button"
              size="icon"
              type="button"
              variant="ghost"
            >
              <Link
                params={{ databaseId }}
                title="Expand database"
                to="/database/$databaseId"
              >
                <Maximize2 />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
