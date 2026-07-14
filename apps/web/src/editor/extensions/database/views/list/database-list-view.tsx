import { useMemo, useState, type DragEvent } from "react"
import { GripVertical, Loader2, Plus } from "lucide-react"
import { useReorderDatabaseRows } from "@notelab/features/databases"

import { DatabasePageLink } from "../../interactions/database-page-link"
import {
  finishDatabaseRowDrag,
  getFilteredReorderedRowIds,
  getReorderedRowIds,
  startDatabaseRowDrag,
} from "../../interactions/database-row-drag"
import { DatabasePropertyValue } from "../../properties/database-property-value"
import { useDatabaseRowsScroll } from "../../interactions/use-database-rows-scroll"
import { useDatabaseViewContext } from "../database-view-context"

export function DatabaseListView() {
  const {
    activeDatabaseFilters,
    activeDatabaseSorts,
    addDatabaseRow,
    databaseId,
    editable,
    fetchNextPage,
    hasNextPage,
    isAddingDatabaseRow,
    isFetchingNextPage,
    items,
    layoutSettings,
    onOpenPage,
    personOptions,
    properties,
    propertyValuesByKey,
    savePropertyValue,
    showPageIconInTitle,
    sortedItems,
    titlePropertyLabel,
    updateDatabasePropertyConfig,
    visibleProperties,
  } = useDatabaseViewContext()
  const reorderRows = useReorderDatabaseRows()
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const rows = useMemo(() => {
    const rowsById = new Map(items.map((row) => [row.id, row]))

    return sortedItems.flatMap((item) => {
      const row = rowsById.get(item.id)
      return row ? [row] : []
    })
  }, [items, sortedItems])
  const canReorderRows = editable && activeDatabaseSorts.length === 0
  const { sentinelRef } = useDatabaseRowsScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  })

  const clearDrag = () => {
    finishDatabaseRowDrag()
    setDraggedRowId(null)
    setDropTargetIndex(null)
  }

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    rowId: string,
  ) => {
    if (!canReorderRows) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", rowId)
    startDatabaseRowDrag()
    setDraggedRowId(rowId)
  }

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    rowIndex: number,
  ) => {
    if (!draggedRowId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    const rowRect = event.currentTarget.getBoundingClientRect()
    const nextIndex =
      event.clientY < rowRect.top + rowRect.height / 2
        ? rowIndex
        : rowIndex + 1

    setDropTargetIndex(nextIndex)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!databaseId || !draggedRowId || dropTargetIndex === null) {
      clearDrag()
      return
    }

    event.preventDefault()
    const rowIds =
      activeDatabaseFilters.length > 0
        ? getFilteredReorderedRowIds(
            items,
            rows,
            draggedRowId,
            dropTargetIndex,
          )
        : getReorderedRowIds(items, draggedRowId, dropTargetIndex)

    if (rowIds) {
      reorderRows.mutate({ databaseId, rowIds })
    }

    clearDrag()
  }

  return (
    <div
      className="database-list-view"
      data-wrap-content={layoutSettings.wrapAllContent ? "true" : undefined}
    >
      <div className="database-list-rows">
        {rows.map((row, rowIndex) => (
          <div
            className="database-list-row"
            data-dragging={draggedRowId === row.id ? "true" : undefined}
            data-drop-after={
              draggedRowId &&
              dropTargetIndex === rowIndex + 1 &&
              rowIndex === rows.length - 1
                ? "true"
                : undefined
            }
            data-drop-before={
              draggedRowId && dropTargetIndex === rowIndex ? "true" : undefined
            }
            key={row.id}
            onDragOver={(event) => handleDragOver(event, rowIndex)}
            onDrop={handleDrop}
          >
            {editable ? (
              <button
                aria-label={`Drag ${row.page.name || "row"}`}
                className="database-list-drag-handle"
                disabled={!canReorderRows}
                draggable={canReorderRows}
                onDragEnd={clearDrag}
                onDragStart={(event) => handleDragStart(event, row.id)}
                title={
                  canReorderRows
                    ? "Drag to reorder"
                    : "Clear sorting to reorder rows"
                }
                type="button"
              >
                <GripVertical />
              </button>
            ) : null}
            <div className="database-list-title">
              <DatabasePageLink
                onOpen={onOpenPage}
                openMode="title"
                pageId={row.pageId}
                pageSummary={row.page}
                showPageIcon={showPageIconInTitle}
              />
            </div>
            <div className="database-list-properties">
              {visibleProperties.map((property) => {
                const key = `${row.pageId}:${property.property.id}`
                const persistedValue = propertyValuesByKey[key] ?? ""

                return (
                  <div
                    className="database-list-property"
                    key={`${row.id}:${property.id}`}
                    title={property.property.name}
                  >
                    <DatabasePropertyValue
                      editable={editable}
                      properties={properties}
                      propertyValuesByKey={propertyValuesByKey}
                      onPropertyConfigChange={(databasePropertyId, config) =>
                        updateDatabasePropertyConfig(databasePropertyId, config)
                      }
                      onSaveValue={savePropertyValue}
                      persistedValue={persistedValue}
                      personOptions={personOptions}
                      property={property}
                      row={row}
                      titlePropertyLabel={titlePropertyLabel}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {hasNextPage || isFetchingNextPage ? (
          <div
            className="flex h-10 items-center justify-center gap-2 text-sm text-muted-foreground"
            ref={sentinelRef}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Loading more rows...</span>
              </>
            ) : null}
          </div>
        ) : null}
        {editable ? (
          <button
            className="database-list-new-row"
            disabled={!databaseId || isAddingDatabaseRow}
            onClick={() => addDatabaseRow()}
            type="button"
          >
            {isAddingDatabaseRow ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            <span>New page</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
