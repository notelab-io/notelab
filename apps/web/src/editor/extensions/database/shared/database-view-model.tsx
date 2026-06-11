import type {
  DatabasePayload,
  DatabaseProperty,
  DatabaseRow,
  WorkspacePropertyValue,
} from "@notelab/features/databases"

import {
  getConfiguredGroupProperty,
  getGroupOptions,
  getKanbanGroupProperty,
  getKanbanOptions,
} from "../kanban/database-kanban-config"
import { getDatabasePropertyType } from "../constants"
import { getPropertyValue, type DatabasePropertyValue } from "../utils"
import {
  getDatabaseSorts,
  getMergedDatabaseConfig,
  getNameColumnLabel,
  getNameColumnShowPageIcon,
  getPropertyHiddenForView,
} from "./database-view-config"
import type { DatabaseSearchableMenuOption } from "./database-searchable-menu-items"
import type { DatabaseActiveSort } from "./database-sort-menu"
import { NameColumnGlyph } from "./name-column-glyph"
import {
  getSortedDatabaseItems,
  hasViewHiddenPropertyIds,
} from "./database-item-utils"

type WorkspacePersonAccessTargets = {
  members?: Array<{
    email: string
    id: string
    name: string
  }>
}

export type DatabaseViewModel = ReturnType<typeof getDatabaseViewModel>

export function getDatabaseViewModel({
  accessTargets,
  activeViewId,
  currentUserId,
  payload,
}: {
  accessTargets?: WorkspacePersonAccessTargets
  activeViewId: string | null
  currentUserId?: string
  payload: DatabasePayload | null | undefined
}) {
  const propertyValues = payload?.values ?? []
  const properties = payload?.properties ?? []
  const items = payload?.rows ?? []
  const personOptions = getPersonOptions(accessTargets, currentUserId)
  const personOptionsById = new Map(
    personOptions.map((personOption) => [personOption.id, personOption.name])
  )
  const titlePropertyLabel = getNameColumnLabel(payload?.database.config)
  const showPageIconInTitle = getNameColumnShowPageIcon(payload?.database.config)
  const activeView =
    payload?.views.find((view) => view.id === activeViewId) ??
    payload?.views[0] ??
    null
  const nameGroupProperty = {
    id: "name",
    position: -1,
    property: {
      config: payload?.database.config,
      id: "name",
      name: titlePropertyLabel,
      type: "text",
    },
  }
  const sortFieldOptions = getSortFieldOptions(titlePropertyLabel, properties)
  const activeViewConfig = activeView?.config ?? payload?.database.config
  const isKanbanView = activeView?.type === "kanban"
  const activeVisibilityConfig = getActiveVisibilityConfig({
    activeViewConfig,
    isKanbanView,
    properties,
  })
  const groupableProperties = [nameGroupProperty, ...properties]
  const visibleProperties = properties.filter(
    (property) =>
      !getPropertyHiddenForView(
        property.id,
        property.property.config,
        activeVisibilityConfig
      )
  )
  const databaseSorts = getDatabaseSorts(activeViewConfig)
  const groupProperty =
    activeViewConfig &&
    typeof activeViewConfig === "object" &&
    !Array.isArray(activeViewConfig) &&
    "groupPropertyId" in activeViewConfig &&
    (activeViewConfig as { groupPropertyId?: unknown }).groupPropertyId === "name"
      ? nameGroupProperty
      : getConfiguredGroupProperty(properties, activeViewConfig)
  const groupOptions = getGroupOptions(groupProperty)
  const kanbanGroupProperty = getKanbanGroupProperty(properties, activeViewConfig)
  const kanbanOptions = getKanbanOptions(kanbanGroupProperty)
  const activeDatabaseSorts = getActiveDatabaseSorts(
    databaseSorts,
    sortFieldOptions
  )
  const usedSortFieldValues = new Set(
    activeDatabaseSorts.map((sort) => sort.column)
  )
  const addableSortFieldOptions = sortFieldOptions.filter(
    (option) => !usedSortFieldValues.has(option.value)
  )
  const propertyValuesByKey = getPropertyValuesByKey({
    items,
    properties,
    propertyValues,
  })
  const sortedItems = getSortedDatabaseItems(
    items,
    properties,
    propertyValuesByKey,
    activeDatabaseSorts,
    personOptionsById
  )

  return {
    activeDatabaseSorts,
    activeView,
    activeViewConfig,
    activeVisibilityConfig,
    addableSortFieldOptions,
    canAddDatabaseSort: activeDatabaseSorts.length < sortFieldOptions.length,
    databaseSorts,
    groupOptions,
    groupProperty,
    groupableProperties,
    isKanbanView,
    items,
    kanbanGroupProperty,
    kanbanOptions,
    personOptions,
    properties,
    propertyValues,
    propertyValuesByKey,
    showPageIconInTitle,
    sortFieldOptions,
    sortedItems,
    titlePropertyLabel,
    visibleProperties,
    visiblePropertyCount: visibleProperties.length + 1,
  }
}

function getPersonOptions(
  accessTargets: WorkspacePersonAccessTargets | undefined,
  currentUserId: string | undefined
) {
  return (accessTargets?.members ?? []).map((member) => ({
    id: member.id,
    name: member.name || member.email,
    suffix: member.id === currentUserId ? "(you)" : undefined,
  }))
}

function getSortFieldOptions(
  titlePropertyLabel: string,
  properties: DatabaseProperty[]
): DatabaseSearchableMenuOption[] {
  return [
    {
      icon: <NameColumnGlyph />,
      label: titlePropertyLabel,
      value: "name",
    },
    ...properties.map((property) => {
      const PropertyIcon = getDatabasePropertyType(property.property.type).icon

      return {
        icon: <PropertyIcon />,
        label: property.property.name,
        value: property.id,
      }
    }),
  ]
}

function getActiveVisibilityConfig({
  activeViewConfig,
  isKanbanView,
  properties,
}: {
  activeViewConfig: unknown
  isKanbanView: boolean
  properties: DatabaseProperty[]
}) {
  if (!isKanbanView || hasViewHiddenPropertyIds(activeViewConfig)) {
    return activeViewConfig
  }

  return getMergedDatabaseConfig(activeViewConfig, {
    hiddenPropertyIds: properties.map((property) => property.id),
  })
}

function getActiveDatabaseSorts(
  databaseSorts: ReturnType<typeof getDatabaseSorts>,
  sortFieldOptions: DatabaseSearchableMenuOption[]
): DatabaseActiveSort[] {
  return databaseSorts.flatMap((sort) => {
    const option = sortFieldOptions.find(
      (sortOption) => sortOption.value === sort.column
    )

    return option
      ? [
          {
            ...sort,
            label: option.label,
          },
        ]
      : []
  })
}

function getPropertyValuesByKey({
  items,
  properties,
  propertyValues,
}: {
  items: DatabaseRow[]
  properties: DatabaseProperty[]
  propertyValues: WorkspacePropertyValue[]
}) {
  const values: Record<string, DatabasePropertyValue> = {}

  for (const row of items) {
    for (const property of properties) {
      values[`${row.pageId}:${property.property.id}`] = getPropertyValue(
        propertyValues,
        row.pageId,
        property.property.id,
        property.property.type
      )
    }
  }

  return values
}
