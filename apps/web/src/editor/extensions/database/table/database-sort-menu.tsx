import { ArrowDownUp, Plus, X } from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerSub,
  DropDrawerSubContent,
  DropDrawerSubTrigger,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { type DatabaseSortDirection } from "./database-column-config"
import {
  DatabaseSearchableMenuItems,
  type DatabaseSearchableMenuOption,
} from "./database-searchable-menu-items"

export type DatabaseActiveSort = {
  column: string
  direction: DatabaseSortDirection
  label: string
}

export type DatabaseSortUpdatePatch = {
  column?: string
  direction?: DatabaseSortDirection
}

type DatabaseSortMenuProps = {
  activeDatabaseSorts: DatabaseActiveSort[]
  addableSortColumnOptions: DatabaseSearchableMenuOption[]
  canAddDatabaseSort: boolean
  onClearDatabaseSort: () => void
  onCreateDatabaseSort: (column: string) => void
  onRemoveDatabaseSort: (index: number) => void
  onUpdateDatabaseSort: (index: number, patch: DatabaseSortUpdatePatch) => void
  sortColumnOptions: DatabaseSearchableMenuOption[]
}

function DatabaseSortMenuContent({
  activeDatabaseSorts,
  addableSortColumnOptions,
  canAddDatabaseSort,
  onClearDatabaseSort,
  onCreateDatabaseSort,
  onRemoveDatabaseSort,
  onUpdateDatabaseSort,
  sortColumnOptions,
}: DatabaseSortMenuProps) {
  const [addSortPickerOpen, setAddSortPickerOpen] = useState(false)

  return (
    <div className="flex w-fit max-w-full flex-col gap-2">
      {activeDatabaseSorts.map((sort, index) => {
        const availableSortOptions = sortColumnOptions.filter(
          (option) =>
            option.value === sort.column ||
            !activeDatabaseSorts.some(
              (activeSort, activeIndex) =>
                activeIndex !== index && activeSort.column === option.value
            )
        )

        return (
          <div className="flex items-center gap-2" key={`${sort.column}:${index}`}>
            <ArrowDownUp className="size-4 text-muted-foreground" />
            <Select
              onValueChange={(column) => onUpdateDatabaseSort(index, { column })}
              value={sort.column}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {availableSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(direction) =>
                onUpdateDatabaseSort(index, {
                  direction: direction as DatabaseSortDirection,
                })
              }
              value={sort.direction}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ascending">Ascending</SelectItem>
                <SelectItem value="descending">Descending</SelectItem>
              </SelectContent>
            </Select>
            <button
              aria-label={`Remove ${sort.label} sort`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onRemoveDatabaseSort(index)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
      {canAddDatabaseSort ? (
        <DropDrawer open={addSortPickerOpen} onOpenChange={setAddSortPickerOpen}>
          <DropDrawerTrigger asChild>
            <button
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
            >
              <Plus className="size-4" />
              <span>Add sort</span>
            </button>
          </DropDrawerTrigger>
          <DropDrawerContent
            align="start"
            className="w-72"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DatabaseSearchableMenuItems
              inputAriaLabel="Add sort property"
              inputIcon={<ArrowDownUp className="size-4" />}
              inputPlaceholder="Sort by..."
              onSelect={onCreateDatabaseSort}
              open={addSortPickerOpen}
              options={addableSortColumnOptions}
            />
          </DropDrawerContent>
        </DropDrawer>
      ) : null}
      <button
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        disabled={activeDatabaseSorts.length === 0}
        onClick={onClearDatabaseSort}
        type="button"
      >
        <X className="size-4" />
        <span>Delete sort</span>
      </button>
    </div>
  )
}

export function DatabaseSortPopover({
  activeDatabaseSorts,
  addableSortColumnOptions,
  canAddDatabaseSort,
  children,
  onClearDatabaseSort,
  onCreateDatabaseSort,
  onRemoveDatabaseSort,
  onUpdateDatabaseSort,
  sortColumnOptions,
}: DatabaseSortMenuProps & {
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-fit min-w-0 max-w-[calc(100vw-2rem)] gap-2 p-3"
      >
        <DatabaseSortMenuContent
          activeDatabaseSorts={activeDatabaseSorts}
          addableSortColumnOptions={addableSortColumnOptions}
          canAddDatabaseSort={canAddDatabaseSort}
          onClearDatabaseSort={onClearDatabaseSort}
          onCreateDatabaseSort={onCreateDatabaseSort}
          onRemoveDatabaseSort={onRemoveDatabaseSort}
          onUpdateDatabaseSort={onUpdateDatabaseSort}
          sortColumnOptions={sortColumnOptions}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DatabaseSortSubmenu({
  activeDatabaseSorts,
  addableSortColumnOptions,
  canAddDatabaseSort,
  children,
  onClearDatabaseSort,
  onCreateDatabaseSort,
  onRemoveDatabaseSort,
  onUpdateDatabaseSort,
  sortColumnOptions,
}: DatabaseSortMenuProps & {
  children: ReactNode
}) {
  return (
    <DropDrawerSub>
      <DropDrawerSubTrigger>{children}</DropDrawerSubTrigger>
      <DropDrawerSubContent className="w-fit min-w-0 max-w-[calc(100vw-2rem)] p-3">
        <DatabaseSortMenuContent
          activeDatabaseSorts={activeDatabaseSorts}
          addableSortColumnOptions={addableSortColumnOptions}
          canAddDatabaseSort={canAddDatabaseSort}
          onClearDatabaseSort={onClearDatabaseSort}
          onCreateDatabaseSort={onCreateDatabaseSort}
          onRemoveDatabaseSort={onRemoveDatabaseSort}
          onUpdateDatabaseSort={onUpdateDatabaseSort}
          sortColumnOptions={sortColumnOptions}
        />
      </DropDrawerSubContent>
    </DropDrawerSub>
  )
}
