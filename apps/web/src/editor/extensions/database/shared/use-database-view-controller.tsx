import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
} from "react"
import { toast } from "sonner"

import { useSession } from "@notelab/features/auth"
import {
  useAddDatabaseView,
  useAddDatabaseProperty,
  useAddDatabaseRow,
  useDatabase,
  useUpdateDatabase,
  useUpdateDatabaseView,
  useUpdateDatabaseProperty,
  useUpdateDatabasePropertyValue,
} from "@notelab/features/databases"
import { useWorkspacePersonAccessTargets } from "@notelab/features/workspaces"

import { defaultStatusOptions } from "../constants"
import {
  getMergedDatabaseConfig,
  getPropertyHidden,
  getViewHiddenPropertyIds,
  type DatabaseSortConfig,
} from "./database-view-config"
import {
  getDatabasePageDragPayload,
  hasDatabasePageDragPayload,
  type DatabasePageDragPayload,
} from "./database-page-drop"
import type { DatabaseViewContextValue } from "./database-view-context"
import {
  areSerializedPropertyValuesEqual,
  hasViewHiddenPropertyIds,
} from "./database-item-utils"
import {
  serializePropertyValue,
  type DatabasePropertyValue,
} from "../utils"
import { getDatabaseViewModel } from "./database-view-model"

export type DatabaseViewProps = {
  databaseId: string | null | undefined
  editable?: boolean
  fullPage?: boolean
  onOpenPage?: (pageId: string) => void
  organizationId?: string | null
  showExpandButton?: boolean
  showTitle?: boolean
}

export function useDatabaseViewController({
  databaseId,
  editable = true,
  fullPage = false,
  onOpenPage,
  organizationId,
  showExpandButton = false,
  showTitle = true,
}: DatabaseViewProps) {
  const [draftPropertyValues, setDraftPropertyValues] = useState<
    Record<string, DatabasePropertyValue>
  >({})
  const updateDatabase = useUpdateDatabase()
  const updateDatabaseView = useUpdateDatabaseView()
  const addDatabaseView = useAddDatabaseView()
  const addProperty = useAddDatabaseProperty()
  const updateProperty = useUpdateDatabaseProperty()
  const addRow = useAddDatabaseRow(organizationId)
  const updateValue = useUpdateDatabasePropertyValue()
  const { data: payload, isLoading } = useDatabase(databaseId)
  const { data: session } = useSession()
  const { data: accessTargets } = useWorkspacePersonAccessTargets(
    payload?.database.pageId
  )
  const [draftDatabaseTitle, setDraftDatabaseTitle] = useState("New database")
  const [draftViewTitle, setDraftViewTitle] = useState("Table")
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [activePropertyValueKey, setActivePropertyValueKey] = useState<string | null>(null)
  const [showSortPill, setShowSortPill] = useState(true)
  const [sortPickerOpen, setSortPickerOpen] = useState(false)

  const viewModel = useMemo(
    () =>
      getDatabaseViewModel({
        accessTargets,
        activeViewId,
        currentUserId: session?.user?.id,
        payload,
      }),
    [accessTargets, activeViewId, payload, session?.user?.id]
  )
  const {
    activeDatabaseSorts,
    activeView,
    activeVisibilityConfig,
    addableSortFieldOptions,
    canAddDatabaseSort,
    isKanbanView,
    items,
    kanbanGroupProperty,
    kanbanOptions,
    personOptions,
    properties,
    propertyValuesByKey,
    showPageIconInTitle,
    sortFieldOptions,
    sortedItems,
    titlePropertyLabel,
    visibleProperties,
    visiblePropertyCount,
  } = viewModel
  useEffect(() => {
    if (payload?.database.name) {
      setDraftDatabaseTitle(payload.database.name)
    }
  }, [payload?.database.id, payload?.database.name])

  useEffect(() => {
    if (!payload?.views.length) {
      setActiveViewId(null)
      return
    }

    if (!activeViewId || !payload.views.some((view) => view.id === activeViewId)) {
      setActiveViewId(payload.views[0].id)
    }
  }, [activeViewId, payload?.views])

  useEffect(() => {
    if (activeView?.name) {
      setDraftViewTitle(activeView.name)
    }
  }, [activeView?.id, activeView?.name])

  useEffect(() => {
    if (activeDatabaseSorts.length === 0) {
      setShowSortPill(false)
    }
  }, [activeDatabaseSorts.length])

  const addTableView = useCallback(() => {
    if (!databaseId || addDatabaseView.isPending) {
      return
    }

    const existingViewIds = new Set((payload?.views ?? []).map((view) => view.id))

    addDatabaseView.mutate(
      {
        databaseId,
        name: "Table",
        type: "table",
      },
      {
        onSuccess: (nextPayload) => {
          const addedView =
            nextPayload.views.find((view) => !existingViewIds.has(view.id)) ??
            nextPayload.views.at(-1)

          setActiveViewId(addedView?.id ?? null)
        },
        onError: () => {
          toast.error("Couldn't add table view")
        },
      }
    )
  }, [addDatabaseView, databaseId, payload?.views])

  const addKanbanView = useCallback(() => {
    if (!databaseId || addDatabaseView.isPending || addProperty.isPending) {
      return
    }

    const existingViewIds = new Set((payload?.views ?? []).map((view) => view.id))
    const currentProperties = payload?.properties ?? []
    const groupProperty =
      currentProperties.find((property) => property.property.type === "status") ??
      currentProperties.find((property) => property.property.type === "select")
    const addView = (
      groupPropertyId: string,
      hiddenPropertyIds: string[],
      onViewAdded?: (nextPayload: { rows: { id: string }[] }) => void
    ) => {
      addDatabaseView.mutate(
        {
          config: { groupPropertyId, hiddenPropertyIds },
          databaseId,
          name: "Kanban",
          type: "kanban",
        },
        {
          onSuccess: (nextPayload) => {
            const addedView =
              nextPayload.views.find((view) => !existingViewIds.has(view.id)) ??
              nextPayload.views.at(-1)

            setActiveViewId(addedView?.id ?? null)
            onViewAdded?.(nextPayload)
          },
          onError: () => {
            toast.error("Couldn't add kanban view")
          },
        }
      )
    }

    if (groupProperty) {
      addView(
        groupProperty.property.id,
        currentProperties.map((property) => property.id)
      )
      return
    }

    const existingPropertyIds = new Set(
      currentProperties.map((property) => property.property.id)
    )

    addProperty.mutate(
      {
        config: {
          defaultOptionId: defaultStatusOptions[0]?.id,
          options: defaultStatusOptions,
        },
        databaseId,
        name: "Status",
        type: "status",
      },
      {
        onSuccess: (nextPayload) => {
          const addedProperty =
            nextPayload.properties.find(
              (property) =>
                !existingPropertyIds.has(property.property.id) &&
                property.property.type === "status"
            ) ??
            nextPayload.properties.find(
              (property) => property.property.type === "status"
            )

          if (!addedProperty) {
            toast.error("Couldn't create status property")
            return
          }

          addView(
            addedProperty.property.id,
            nextPayload.properties.map((property) => property.id),
            (viewPayload) => {
              for (const row of viewPayload.rows) {
                updateValue.mutate({
                  databaseId,
                  propertyId: addedProperty.property.id,
                  rowId: row.id,
                  value: defaultStatusOptions[0]?.name ?? "Not started",
                })
              }
            }
          )
        },
        onError: () => {
          toast.error("Couldn't create status property")
        },
      }
    )
  }, [
    addDatabaseView,
    addProperty,
    databaseId,
    payload?.properties,
    payload?.views,
    updateValue,
  ])

  const addDatabaseRow = (groupValue?: string) => {
    if (!editable || !databaseId || addRow.isPending) {
      return
    }

    const existingItemIds = new Set(items.map((row) => row.id))
    const defaultStatusValue = defaultStatusOptions[0]?.name ?? "Not started"
    const nextGroupValue =
      groupValue ??
      (isKanbanView && kanbanGroupProperty?.property.type === "status"
        ? defaultStatusValue
        : null)

    addRow.mutate(
      {
        databaseId,
        title: "Untitled",
      },
      {
        onSuccess: (nextPayload) => {
          if (!nextGroupValue || !kanbanGroupProperty) {
            return
          }

          const addedItem =
            nextPayload.rows.find((row) => !existingItemIds.has(row.id)) ??
            nextPayload.rows.at(-1)

          if (!addedItem) {
            return
          }

          updateValue.mutate({
            databaseId,
            propertyId: kanbanGroupProperty.property.id,
            rowId: addedItem.id,
            value: serializePropertyValue(
              kanbanGroupProperty.property.type,
              nextGroupValue
            ),
          })
        },
      }
    )
  }

  const addDatabaseProperty = (
    type = "text",
    label = "Property",
    position?: number
  ) => {
    if (!editable || !databaseId || addProperty.isPending) {
      return
    }

    addProperty.mutate({
      config:
        type === "status"
          ? {
              defaultOptionId: defaultStatusOptions[0]?.id,
              options: defaultStatusOptions,
            }
          : undefined,
      databaseId,
      name: label,
      position,
      type,
    })
  }
  const updateDatabasePropertyConfig = (
    databasePropertyId: string,
    config: unknown
  ) => {
    if (!databaseId) {
      return Promise.resolve()
    }

    return updateProperty.mutateAsync({
      config,
      databaseId,
      databasePropertyId,
    })
  }
  const renameDatabaseProperty = (databasePropertyId: string, name: string) => {
    if (!databaseId) {
      return
    }

    updateProperty.mutate({
      databaseId,
      databasePropertyId,
      name,
    })
  }
  const saveDatabaseSorts = (nextSorts: DatabaseSortConfig[]) => {
    if (!databaseId || !activeView?.id) {
      return
    }

    updateDatabaseView.mutate({
      config: getMergedDatabaseConfig(activeView.config, {
        sort: undefined,
        sorts: nextSorts.length > 0 ? nextSorts : undefined,
      }),
      databaseId,
      databaseViewId: activeView.id,
    })
  }
  const createDatabaseSort = (field: string) => {
    saveDatabaseSorts([
      ...activeDatabaseSorts.map(({ column, direction }) => ({
        column,
        direction,
      })),
      {
        column: field,
        direction: "ascending",
      },
    ])
    setShowSortPill(true)
    setSortPickerOpen(false)
  }
  const updateDatabaseSort = (
    index: number,
    patch: Partial<DatabaseSortConfig>
  ) => {
    saveDatabaseSorts(
      activeDatabaseSorts.map(({ column, direction }, sortIndex) =>
        sortIndex === index ? { column, direction, ...patch } : { column, direction }
      )
    )
  }
  const removeDatabaseSort = (index: number) => {
    saveDatabaseSorts(
      activeDatabaseSorts.flatMap(({ column, direction }, sortIndex) =>
        sortIndex === index ? [] : [{ column, direction }]
      )
    )
  }
  const clearDatabaseSort = () => {
    saveDatabaseSorts([])
  }
  const togglePropertyVisibility = (propertyId: string) => {
    if (!databaseId || !activeView?.id) {
      return
    }

    const hiddenPropertyIds = new Set(
      hasViewHiddenPropertyIds(activeView.config)
        ? getViewHiddenPropertyIds(activeView.config)
        : isKanbanView
          ? properties.map((property) => property.id)
        : properties
            .filter((property) => getPropertyHidden(property.property.config))
            .map((property) => property.id)
    )

    if (hiddenPropertyIds.has(propertyId)) {
      hiddenPropertyIds.delete(propertyId)
    } else {
      hiddenPropertyIds.add(propertyId)
    }

    updateDatabaseView.mutate({
      config: getMergedDatabaseConfig(activeView.config, {
        hiddenPropertyIds: [...hiddenPropertyIds],
      }),
      databaseId,
      databaseViewId: activeView.id,
    })
  }
  const toggleSortPillVisibility = () => {
    setShowSortPill((visible) => !visible)
  }
  const saveDatabaseTitle = useCallback(
    (nextTitle: string) => {
      if (!databaseId || nextTitle === payload?.database.name) {
        return
      }

      updateDatabase.mutate({
        databaseId,
        name: nextTitle,
      })
    },
    [databaseId, payload?.database.name, updateDatabase]
  )
  const saveDatabaseViewTitle = useCallback(
    (nextTitle: string) => {
      if (
        !databaseId ||
        !activeView?.id ||
        nextTitle === activeView.name
      ) {
        return
      }

      updateDatabaseView.mutate({
        databaseId,
        databaseViewId: activeView.id,
        name: nextTitle,
      })
    },
    [activeView?.id, activeView?.name, databaseId, updateDatabaseView]
  )
  const copyDatabaseViewLink = useCallback(() => {
    if (!databaseId || typeof window === "undefined") {
      return
    }

    void navigator.clipboard
      .writeText(`${window.location.origin}/database/${databaseId}`)
      .then(() => {
        toast.success("Copied link to view")
      })
      .catch(() => {
        toast.error("Couldn't copy link to view")
      })
  }, [databaseId])

  const savePropertyValue = (
    rowId: string,
    propertyId: string,
    propertyType: string,
    currentValue: DatabasePropertyValue,
    nextValue: DatabasePropertyValue
  ) => {
    if (!editable || !databaseId) {
      return
    }

    if (
      areSerializedPropertyValuesEqual(propertyType, currentValue, nextValue)
    ) {
      return
    }

    updateValue.mutate({
      databaseId,
      propertyId,
      rowId,
      value: serializePropertyValue(propertyType, nextValue),
    })
  }

  const addDraggedPageRow = (
    dragPayload: DatabasePageDragPayload,
    position: number
  ) => {
    if (!databaseId || addRow.isPending) {
      return
    }

    if (dragPayload.pageId === payload?.database.pageId) {
      toast.error("You can't nest a page inside itself.")
      return
    }

    if (items.some((row) => row.pageId === dragPayload.pageId)) {
      toast.error("This page is already in this database.")
      return
    }

    addRow.mutate({
      databaseId,
      pageId: dragPayload.pageId,
      position,
      title: dragPayload.title,
    })
  }

  const handleDatabaseBlockDragOver = (
    event: ReactDragEvent<HTMLDivElement>
  ) => {
    if (!hasDatabasePageDragPayload(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handleDatabaseBlockDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const dragPayload = getDatabasePageDragPayload(event.dataTransfer)

    if (!dragPayload) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    addDraggedPageRow(dragPayload, items.length)
  }

  const databaseViewContext: DatabaseViewContextValue = {
    activePropertyValueKey,
    activeDatabaseSorts,
    activeView,
    activeVisibilityConfig,
    addableSortFieldOptions,
    addDatabaseProperty,
    addDraggedPageRow,
    addKanbanView,
    addDatabaseRow,
    addTableView,
    canAddDatabaseSort,
    propertyValuesByKey,
    clearDatabaseSort,
    copyDatabaseViewLink,
    createDatabaseSort,
    databaseConfig: payload?.database.config,
    databaseId,
    databaseName: payload?.database.name,
    databaseOrganizationId: payload?.database.organizationId,
    draftPropertyValues,
    draftDatabaseTitle,
    draftViewTitle,
    editable,
    getDatabasePageDragPayload,
    groupProperty: kanbanGroupProperty,
    hasDatabasePageDragPayload,
    isAddingDatabaseProperty: addProperty.isPending,
    isAddingDatabaseRow: addRow.isPending,
    isAddingDatabaseView: addDatabaseView.isPending,
    titlePropertyLabel,
    showPageIconInTitle,
    onOpenPage,
    options: kanbanOptions,
    organizationId,
    personOptions,
    properties,
    removeDatabaseSort,
    renameDatabaseProperty,
    items,
    savePropertyValue,
    saveDatabaseTitle,
    saveDatabaseSorts,
    saveDatabaseViewTitle,
    setActivePropertyValueKey,
    setActiveViewId,
    setDraftPropertyValues,
    setDraftDatabaseTitle,
    setDraftViewTitle,
    setSortPickerOpen,
    showExpandButton,
    showSortPill,
    showTitle,
    sortFieldOptions,
    sortPickerOpen,
    sortedItems,
    togglePropertyVisibility,
    toggleSortPillVisibility,
    updateDatabasePropertyConfig,
    updateDatabaseSort,
    visibleProperties,
    visiblePropertyCount,
    views: payload?.views ?? [],
  }

  return {
    className: fullPage
      ? "database-block-shell database-block-shell-full"
      : "database-block-shell",
    context: databaseViewContext,
    databaseId,
    handleDatabaseBlockDragOver,
    handleDatabaseBlockDrop,
    isLoading,
    payload,
    viewType: activeView?.type,
  }
}
