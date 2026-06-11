import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@notelab/features/databases"

import type {
  DatabasePropertyValue,
} from "../utils"
import type {
  DatabasePropertyListItem,
  DatabaseSelectOption,
} from "../kanban/database-kanban-config"
import type {
  DatabaseSearchableMenuOption,
} from "./database-searchable-menu-items"
import type {
  DatabaseActiveSort,
  DatabaseSortUpdatePatch,
} from "./database-sort-menu"
import type {
  DatabaseSortConfig,
} from "./database-view-config"
import type {
  DatabasePageDragPayload,
} from "./database-page-drop"
import type {
  SortableDatabaseItem,
} from "./database-item-utils"

export type DatabaseViewContextValue = {
  activeDatabaseSorts: DatabaseActiveSort[]
  activePropertyValueKey: string | null
  activeView: DatabaseView | null
  activeVisibilityConfig: unknown
  addableSortFieldOptions: DatabaseSearchableMenuOption[]
  addDatabaseProperty: (type?: string, label?: string, position?: number) => void
  addDatabaseRow: (
    groupValue?: string,
    groupProperty?: DatabasePropertyListItem | null
  ) => void
  addDraggedPageRow: (
    dragPayload: DatabasePageDragPayload,
    position: number
  ) => void
  addKanbanView: () => void
  addTableView: () => void
  canAddDatabaseSort: boolean
  clearDatabaseSort: () => void
  copyDatabaseViewLink: () => void
  createDatabaseSort: (field: string) => void
  databaseConfig?: unknown
  databaseId: string | null | undefined
  databaseName?: string
  databaseOrganizationId?: string
  draftDatabaseTitle: string
  draftPropertyValues: Record<string, DatabasePropertyValue>
  draftViewTitle: string
  editable: boolean
  getDatabasePageDragPayload: (
    dataTransfer: DataTransfer | null
  ) => DatabasePageDragPayload | null
  groupOptions: DatabaseSelectOption[]
  groupProperty: DatabasePropertyListItem | null
  groupableProperties: DatabasePropertyListItem[]
  hasDatabasePageDragPayload: (dataTransfer: DataTransfer | null) => boolean
  isAddingDatabaseProperty: boolean
  isAddingDatabaseRow: boolean
  isAddingDatabaseView: boolean
  items: DatabaseRow[]
  onOpenPage?: (pageId: string) => void
  options: DatabaseSelectOption[]
  organizationId?: string | null
  personOptions: Array<{ id: string; name: string; suffix?: string }>
  properties: DatabaseProperty[]
  propertyValuesByKey: Record<string, DatabasePropertyValue>
  removeDatabaseSort: (index: number) => void
  renameDatabaseProperty: (databasePropertyId: string, name: string) => void
  saveDatabaseTitle: (nextTitle: string) => void
  saveDatabaseViewTitle: (nextTitle: string) => void
  saveDatabaseSorts: (nextSorts: DatabaseSortConfig[]) => void
  savePropertyValue: (
    rowId: string,
    propertyId: string,
    propertyType: string,
    currentValue: DatabasePropertyValue,
    nextValue: DatabasePropertyValue
  ) => void
  setActivePropertyValueKey: (key: string | null) => void
  setActiveViewId: Dispatch<SetStateAction<string | null>>
  setDraftDatabaseTitle: Dispatch<SetStateAction<string>>
  setDraftPropertyValues: Dispatch<
    SetStateAction<Record<string, DatabasePropertyValue>>
  >
  setDraftViewTitle: Dispatch<SetStateAction<string>>
  setViewGroupProperty: (groupPropertyId: string | null) => void
  setSortPickerOpen: Dispatch<SetStateAction<boolean>>
  showExpandButton: boolean
  showPageIconInTitle: boolean
  showSortPill: boolean
  showTitle: boolean
  sortFieldOptions: DatabaseSearchableMenuOption[]
  sortPickerOpen: boolean
  sortedItems: SortableDatabaseItem[]
  titlePropertyLabel: string
  togglePropertyVisibility: (propertyId: string) => void
  toggleSortPillVisibility: () => void
  updateDatabasePropertyConfig: (
    databasePropertyId: string,
    config: unknown
  ) => Promise<unknown>
  updateDatabaseSort: (index: number, patch: DatabaseSortUpdatePatch) => void
  visibleProperties: DatabaseProperty[]
  visiblePropertyCount: number
  views: DatabaseView[]
}

const DatabaseViewContext = createContext<DatabaseViewContextValue | null>(null)

export function DatabaseViewProvider({
  children,
  value,
}: {
  children: ReactNode
  value: DatabaseViewContextValue
}) {
  return (
    <DatabaseViewContext.Provider value={value}>
      {children}
    </DatabaseViewContext.Provider>
  )
}

export function useDatabaseViewContext() {
  const value = useContext(DatabaseViewContext)

  if (!value) {
    throw new Error("useDatabaseViewContext must be used inside DatabaseViewProvider")
  }

  return value
}
