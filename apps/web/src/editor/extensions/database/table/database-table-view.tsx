import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
} from "react"
import { FileText, GripVertical, Loader2, Plus } from "lucide-react"
import { useReorderDatabaseRows } from "@notelab/features/databases"

import { AddDatabasePropertyMenu } from "../shared/add-database-property-menu"
import { DatabaseTableCellContent } from "./database-table-cell-content"
import {
  databaseAddPropertyColumnDefaultWidth,
  databaseColumnMinWidth,
  databaseNameColumnDefaultWidth,
  DATABASE_PAGE_DRAG_MIME,
} from "../constants"
import { DatabasePageLink } from "../shared/database-page-link"
import {
  DatabaseNamePropertyMenu,
  DatabasePropertyMenu,
} from "../shared/database-property-menu"
import { DatabasePropertyValue } from "../shared/database-property-value"
import {
  getNameColumnWrapContent,
  getPropertyWrapContent,
} from "../shared/database-view-config"
import { useDatabaseViewContext } from "../shared/database-view-context"
import {
  hideNativeTableRowDragPreview,
  type TableRowDragOverlay,
} from "./database-table-row-drag"

type InsertPropertySide = "left" | "right"

type PendingInsertProperty = {
  position: number
  side: InsertPropertySide
  sourceColumnKey: string
}

function getColumnWidth(columnWidths: Record<string, number>, key: string) {
  return (
    columnWidths[key] ??
    (key === "name"
      ? databaseNameColumnDefaultWidth
      : key === "add-property"
        ? databaseAddPropertyColumnDefaultWidth
        : key.startsWith("insert-property-")
          ? databaseAddPropertyColumnDefaultWidth
          : databaseColumnMinWidth)
  )
}

export function DatabaseTableView() {
  const {
    activePropertyValueKey,
    activeDatabaseSorts,
    addDatabaseProperty,
    addDraggedPageRow,
    addProperty,
    addRow,
    propertyValuesByKey,
    databaseId,
    draftPropertyValues,
    editable,
    getDatabasePageDragPayload,
    hasDatabasePageDragPayload,
    titlePropertyLabel: nameColumnLabel,
    showPageIconInTitle: nameColumnShowPageIcon,
    onAddDatabaseRow,
    onOpenPage,
    payload,
    personOptions,
    items: rows,
    savePropertyValue,
    setActivePropertyValueKey,
    setDraftPropertyValues,
    sortedItems: sortedRows,
    updateProperty,
    visibleProperties,
  } = useDatabaseViewContext()
  const reorderRows = useReorderDatabaseRows()
  const nameColumnWrapContent = getNameColumnWrapContent(payload?.database.config)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)
  const [rowDragOverlay, setRowDragOverlay] =
    useState<TableRowDragOverlay | null>(null)
  const [rowDropTargetIndex, setRowDropTargetIndex] = useState<number | null>(
    null
  )
  const [pendingInsertProperty, setPendingInsertProperty] =
    useState<PendingInsertProperty | null>(null)
  const [editingPropertyKey, setEditingPropertyKey] = useState<string | null>(
    null
  )
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const [rowLayout, setRowLayout] = useState<{
    centers: Record<string, number>
    dropTops: number[]
  }>({ centers: {}, dropTops: [] })
  const isTableSorted = activeDatabaseSorts.length > 0
  const activeInsertProperty = pendingInsertProperty
  const pendingInsertPropertyKey = activeInsertProperty
    ? `insert-property-${activeInsertProperty.sourceColumnKey}-${activeInsertProperty.side}`
    : null
  const columnKeys = (() => {
    const nameKeys =
      activeInsertProperty?.sourceColumnKey === "name"
        ? activeInsertProperty.side === "left"
          ? ["insert-property-name-left", "name"]
          : ["name", "insert-property-name-right"]
        : ["name"]
    const propertyKeys = visibleProperties.flatMap((property: any) => {
      if (
        !activeInsertProperty ||
        property.id !== activeInsertProperty.sourceColumnKey
      ) {
        return [property.id]
      }

      const insertKey = `insert-property-${property.id}-${activeInsertProperty.side}`

      return activeInsertProperty.side === "left"
        ? [insertKey, property.id]
        : [property.id, insertKey]
    })

    return [...nameKeys, ...propertyKeys, ...(editable ? ["add-property"] : [])]
  })()
  const tableMinWidth = columnKeys.reduce(
    (width, key) => width + getColumnWidth(columnWidths, key),
    0
  )
  const getRowElements = useCallback(() => {
    return Array.from(
      tableWrapRef.current?.querySelectorAll<HTMLTableRowElement>(
        ".database-table tbody tr[data-database-row-id]"
      ) ?? []
    )
  }, [])
  const measureRows = useCallback(() => {
    const wrapperElement = tableWrapRef.current

    if (!wrapperElement) {
      return { centers: {}, dropTops: [] }
    }

    const wrapperRect = wrapperElement.getBoundingClientRect()
    const rowElements = getRowElements()
    const centers: Record<string, number> = {}
    const dropTops: number[] = []

    rowElements.forEach((rowElement, index) => {
      const rect = rowElement.getBoundingClientRect()
      const top = rect.top - wrapperRect.top
      const height = rect.height
      const rowId = rowElement.dataset.databaseRowId

      if (rowId) {
        centers[rowId] = top + height / 2
      }

      dropTops[index] = top

      if (index === rowElements.length - 1) {
        dropTops[index + 1] = top + height
      }
    })

    setRowLayout({ centers, dropTops })

    return { centers, dropTops }
  }, [getRowElements])
  const getRowDropTargetIndex = (clientY: number) => {
    const rowElements = getRowElements()

    if (rowElements.length === 0) {
      return 0
    }

    const targetIndex = rowElements.findIndex((rowElement) => {
      const rect = rowElement.getBoundingClientRect()

      return clientY < rect.top + rect.height / 2
    })

    return targetIndex === -1 ? rowElements.length : targetIndex
  }
  const moveDraggedRow = () => {
    if (!databaseId || !draggedRowId || rowDropTargetIndex === null || isTableSorted) {
      return
    }

    const sourceIndex = rows.findIndex((row: any) => row.id === draggedRowId)

    if (sourceIndex === -1) {
      return
    }

    const nextRows = [...rows]
    const [draggedRow] = nextRows.splice(sourceIndex, 1)
    const nextTargetIndex =
      rowDropTargetIndex > sourceIndex
        ? rowDropTargetIndex - 1
        : rowDropTargetIndex

    nextRows.splice(nextTargetIndex, 0, draggedRow)

    const rowIds = nextRows.map((row: any) => row.id)

    if (rowIds.every((rowId: string, index: number) => rowId === rows[index]?.id)) {
      return
    }

    reorderRows.mutate({ databaseId, rowIds })
  }
  const clearRowDrag = () => {
    setDraggedRowId(null)
    setRowDragOverlay(null)
    setRowDropTargetIndex(null)
  }
  const rowDropLineTop =
    rowDropTargetIndex === null
      ? null
      : (rowLayout.dropTops[rowDropTargetIndex] ?? null)
  const activeDragRowId = draggedRowId ?? hoveredRowId
  const activeDragRowIndex = activeDragRowId
    ? sortedRows.findIndex((row: any) => row.id === activeDragRowId)
    : -1
  const activeDragRow =
    activeDragRowIndex === -1 ? null : sortedRows[activeDragRowIndex]

  useEffect(() => {
    if (
      editingPropertyKey &&
      editingPropertyKey !== "name" &&
      !visibleProperties.some((property: any) => property.id === editingPropertyKey)
    ) {
      setEditingPropertyKey(null)
    }
  }, [editingPropertyKey, visibleProperties])

  useEffect(() => {
    if (
      pendingInsertProperty &&
      pendingInsertProperty.sourceColumnKey !== "name" &&
      !visibleProperties.some(
        (property: any) => property.id === pendingInsertProperty.sourceColumnKey
      )
    ) {
      setPendingInsertProperty(null)
    }
  }, [pendingInsertProperty, visibleProperties])

  useEffect(() => {
    window.addEventListener("resize", measureRows)

    return () => window.removeEventListener("resize", measureRows)
  }, [measureRows])

  useEffect(() => {
    if (!rowDragOverlay) {
      return
    }

    const moveOverlay = (event: DragEvent) => {
      setRowDragOverlay((overlay: any) =>
        overlay
          ? {
              ...overlay,
              left: event.clientX - overlay.offsetX,
              top: event.clientY - overlay.offsetY,
            }
          : overlay
      )
    }

    window.addEventListener("dragover", moveOverlay)

    return () => window.removeEventListener("dragover", moveOverlay)
  }, [rowDragOverlay])

  useLayoutEffect(() => {
    measureRows()
  }, [activePropertyValueKey, measureRows, visibleProperties, sortedRows])
  const startColumnResize = (
    columnKey: string,
    event: React.PointerEvent<HTMLSpanElement>
  ) => {
    if (!editable) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getColumnWidth(columnWidths, columnKey)

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = Math.max(
        databaseColumnMinWidth,
        startWidth + moveEvent.clientX - startX
      )

      setColumnWidths((widths: Record<string, number>) => ({
        ...widths,
        [columnKey]: nextWidth,
      }))
    }

    const removeListeners = () => {
      document.body.classList.remove("database-resize-cursor")
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", removeListeners)
      window.removeEventListener("pointercancel", removeListeners)
    }

    document.body.classList.add("database-resize-cursor")
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", removeListeners)
    window.addEventListener("pointercancel", removeListeners)
  }

  const handleEditingPropertyOpenChange = (
    propertyKey: string,
    nextOpen: boolean
  ) => {
    setEditingPropertyKey((currentKey: string | null) =>
      nextOpen ? propertyKey : currentKey === propertyKey ? null : currentKey
    )
  }

  const openInsertPropertyMenu = (
    sourceColumnKey: string,
    sourcePosition: number,
    side: "left" | "right"
  ) => {
    setPendingInsertProperty({
      position: sourcePosition + (side === "right" ? 1 : 0),
      side,
      sourceColumnKey,
    })
  }

  const clearPendingInsertProperty = (insertKey: string) => {
    setPendingInsertProperty((current: any) => {
      const currentKey = current
        ? `insert-property-${current.sourceColumnKey}-${current.side}`
        : null

      return currentKey === insertKey ? null : current
    })
  }

  const addInsertedDatabaseProperty = (
    type: string,
    label: string,
    position: number,
    insertKey: string
  ) => {
    addDatabaseProperty(type, label, position)
    clearPendingInsertProperty(insertKey)
  }

  const renderInsertPropertyHeader = (insertKey: string, position: number) => (
    <th
      className="database-add-property-cell database-insert-property-cell"
      key={insertKey}
    >
      <AddDatabasePropertyMenu
        disabled={addProperty.isPending}
        isPending={addProperty.isPending}
        onAdd={(type, label) =>
          addInsertedDatabaseProperty(type, label, position, insertKey)
        }
        onOpenChange={(open) => {
          if (!open) {
            clearPendingInsertProperty(insertKey)
          }
        }}
        open={pendingInsertPropertyKey === insertKey}
        triggerLabel="Select type"
      />
      <span
        aria-hidden="true"
        className="database-column-resize-handle"
        onPointerDown={(event) => startColumnResize(insertKey, event)}
      />
    </th>
  )

  const renderInsertPropertyCell = (insertKey: string) => (
    <td
      aria-hidden="true"
      className="database-value-cell database-insert-property-placeholder"
      key={insertKey}
    />
  )

  return (
    <div
      className="database-table-wrap"
      ref={tableWrapRef}
      onMouseLeave={() => {
        if (!draggedRowId) {
          setHoveredRowId(null)
        }
      }}
      onDragLeave={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget as globalThis.Node | null
          )
        ) {
          setRowDropTargetIndex(null)
        }
      }}
      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
        const hasDragPayload = hasDatabasePageDragPayload(event.dataTransfer)

        if (!draggedRowId && !hasDragPayload) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = "move"
        if (draggedRowId) {
          setRowDragOverlay((overlay: any) =>
            overlay
              ? {
                  ...overlay,
                  left: event.clientX - overlay.offsetX,
                  top: event.clientY - overlay.offsetY,
                }
              : overlay
          )
        }
        measureRows()
        setRowDropTargetIndex(getRowDropTargetIndex(event.clientY))
      }}
      onDrop={(event) => {
        const dragPayload = getDatabasePageDragPayload(event.dataTransfer)

        if ((!draggedRowId && !dragPayload) || rowDropTargetIndex === null) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        if (draggedRowId) {
          moveDraggedRow()
        } else if (dragPayload) {
          addDraggedPageRow(dragPayload, rowDropTargetIndex)
        }
        clearRowDrag()
      }}
    >
      {editable && !isTableSorted ? (
        <div className="database-row-drag-rail">
          {activeDragRow ? (
            <button
              aria-label={`Drag ${activeDragRow.page.name.trim() || "Untitled"}`}
              className="database-row-drag-handle"
              data-database-row-drag-handle
              data-dragging={draggedRowId === activeDragRow.id ? "true" : undefined}
              data-visible="true"
              draggable
              key="database-row-drag-handle"
              onClick={(event) => event.preventDefault()}
              onDragStart={(event) => {
                measureRows()
                const rowElement = tableWrapRef.current?.querySelector(
                  `tr[data-database-row-id="${activeDragRow.id}"]`
                )
                const rowRect = rowElement?.getBoundingClientRect()
                const tableRect = tableWrapRef.current
                  ?.querySelector(".database-table")
                  ?.getBoundingClientRect()

                if (rowRect && tableRect) {
                  setRowDragOverlay({
                    height: rowRect.height,
                    left: rowRect.left,
                    offsetX: event.clientX - rowRect.left,
                    offsetY: event.clientY - rowRect.top,
                    title: activeDragRow.page.name.trim() || "Untitled",
                    top: rowRect.top,
                    width: tableRect.width,
                  })
                }

                hideNativeTableRowDragPreview(event.dataTransfer)
                setDraggedRowId(activeDragRow.id)
                setRowDropTargetIndex(activeDragRowIndex)
                event.dataTransfer.effectAllowed = "copyMove"
                event.dataTransfer.setData(
                  DATABASE_PAGE_DRAG_MIME,
                  JSON.stringify({
                    databaseId: payload.database.id,
                    pageId: activeDragRow.pageId,
                    rowId: activeDragRow.id,
                  })
                )
                event.dataTransfer.setData(
                  "text/plain",
                  activeDragRow.page.name.trim() || "Untitled"
                )
              }}
              onDragEnd={clearRowDrag}
              onMouseEnter={() => {
                measureRows()
                setHoveredRowId(activeDragRow.id)
              }}
              style={{ top: rowLayout.centers[activeDragRow.id] ?? 0 }}
              title="Drag page"
              type="button"
            >
              <GripVertical />
            </button>
          ) : null}
        </div>
      ) : null}
      {rowDragOverlay ? (
        <div
          aria-hidden="true"
          className="database-row-drag-overlay"
          style={{
            height: rowDragOverlay.height,
            left: rowDragOverlay.left,
            top: rowDragOverlay.top,
            width: rowDragOverlay.width,
          }}
        >
          <span className="database-row-drag-overlay-cell">
            <FileText />
            <span>{rowDragOverlay.title}</span>
          </span>
        </div>
      ) : null}
      {rowDropLineTop !== null ? (
        <div
          className="pointer-events-none absolute left-0 right-0 z-30 h-0.5 -translate-y-px bg-primary"
          style={{ top: rowDropLineTop }}
        />
      ) : null}
      <div className="database-table-scroll">
        <table
          className="database-table"
          style={
            {
              "--database-table-min-width": `${tableMinWidth}px`,
            } as CSSProperties
          }
        >
          <colgroup>
            {columnKeys.map((key) => (
              <col key={key} style={{ width: getColumnWidth(columnWidths, key) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {pendingInsertPropertyKey === "insert-property-name-left"
                ? renderInsertPropertyHeader("insert-property-name-left", 0)
                : null}
              <th className="database-name-header">
                {editable ? (
                  <DatabaseNamePropertyMenu
                    config={payload.database.config}
                    databaseId={payload.database.id}
                    onOpenChange={(open) =>
                      handleEditingPropertyOpenChange("name", open)
                    }
                    onInsertProperty={(side) =>
                      openInsertPropertyMenu("name", 0, side)
                    }
                    open={editingPropertyKey === "name"}
                  />
                ) : (
                  <span className="database-name-header-content">
                    <span>Aa</span>
                    <span>{nameColumnLabel}</span>
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="database-column-resize-handle"
                  onPointerDown={(event) => startColumnResize("name", event)}
                />
              </th>
              {pendingInsertPropertyKey === "insert-property-name-right"
                ? renderInsertPropertyHeader("insert-property-name-right", 1)
                : null}
              {visibleProperties.map((property: any) => {
                const leftInsertKey = `insert-property-${property.id}-left`
                const rightInsertKey = `insert-property-${property.id}-right`
                const showLeftInsert = pendingInsertPropertyKey === leftInsertKey
                const showRightInsert = pendingInsertPropertyKey === rightInsertKey

                return (
                  <Fragment key={property.id}>
                    {showLeftInsert
                      ? renderInsertPropertyHeader(
                          leftInsertKey,
                          pendingInsertProperty?.position ?? property.position
                        )
                      : null}
                    <th className="database-property-header">
                      {editable ? (
                        <DatabasePropertyMenu
                          config={property.property.config}
                          databaseConfig={payload.database.config}
                          databaseId={payload.database.id}
                          databasePropertyId={property.id}
                          name={property.property.name}
                          onOpenChange={(open) =>
                            handleEditingPropertyOpenChange(property.id, open)
                          }
                          type={property.property.type}
                          onInsertProperty={(side) =>
                            openInsertPropertyMenu(
                              property.id,
                              property.position,
                              side
                            )
                          }
                          onRename={(name) =>
                            updateProperty.mutate({
                              databaseId: payload.database.id,
                              databasePropertyId: property.id,
                              name,
                            })
                          }
                          open={editingPropertyKey === property.id}
                        />
                      ) : (
                        <span className="database-property-header-label">
                          {property.property.name}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="database-column-resize-handle"
                        onPointerDown={(event) =>
                          startColumnResize(property.id, event)
                        }
                      />
                    </th>
                    {showRightInsert
                      ? renderInsertPropertyHeader(
                          rightInsertKey,
                          pendingInsertProperty?.position ?? property.position + 1
                        )
                      : null}
                  </Fragment>
                )
              })}
              {editable ? (
                <th className="database-add-property-cell">
                  <AddDatabasePropertyMenu
                    disabled={addProperty.isPending}
                    isPending={addProperty.isPending}
                    onAdd={addDatabaseProperty}
                  />
                  <span
                    aria-hidden="true"
                    className="database-column-resize-handle"
                    onPointerDown={(event) =>
                      startColumnResize("add-property", event)
                    }
                  />
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row: any) => (
              <tr
                data-database-row-id={row.id}
                key={row.id}
                onMouseEnter={() => {
                  measureRows()
                  setHoveredRowId(row.id)
                }}
              >
                {pendingInsertPropertyKey === "insert-property-name-left"
                  ? renderInsertPropertyCell("insert-property-name-left")
                  : null}
                <td className="database-page-cell">
                  <DatabaseTableCellContent wrapContent={nameColumnWrapContent}>
                    <DatabasePageLink
                      onOpen={onOpenPage}
                      pageId={row.pageId}
                      showPageIcon={nameColumnShowPageIcon}
                    />
                  </DatabaseTableCellContent>
                </td>
                {pendingInsertPropertyKey === "insert-property-name-right"
                  ? renderInsertPropertyCell("insert-property-name-right")
                  : null}
                {visibleProperties.map((property: any) => {
                  const leftInsertKey = `insert-property-${property.id}-left`
                  const rightInsertKey = `insert-property-${property.id}-right`
                  const showLeftInsert = pendingInsertPropertyKey === leftInsertKey
                  const showRightInsert = pendingInsertPropertyKey === rightInsertKey
                  const workspaceProperty = property.property
                  const key = `${row.pageId}:${workspaceProperty.id}`
                  const persistedValue = propertyValuesByKey[key] ?? ""
                  const value = draftPropertyValues[key] ?? persistedValue
                  const wrapContent = getPropertyWrapContent(workspaceProperty.config)

                  return (
                    <Fragment key={property.id}>
                      {showLeftInsert ? renderInsertPropertyCell(leftInsertKey) : null}
                      <td
                        className="database-value-cell"
                        data-active={activePropertyValueKey === key ? "true" : undefined}
                        data-wrap-content={wrapContent ? "true" : undefined}
                      >
                        <DatabaseTableCellContent wrapContent={wrapContent}>
                          <DatabasePropertyValue
                            draftValues={draftPropertyValues}
                            editable={editable}
                            onActiveValueChange={setActivePropertyValueKey}
                            onDraftValuesChange={setDraftPropertyValues}
                            onPropertyConfigChange={(databasePropertyId, config) =>
                              updateProperty.mutateAsync({
                                config,
                                databaseId: payload.database.id,
                                databasePropertyId,
                              })
                            }
                            onSaveValue={savePropertyValue}
                            persistedValue={persistedValue}
                            personOptions={personOptions}
                            property={property}
                            row={row}
                            value={value}
                          />
                        </DatabaseTableCellContent>
                      </td>
                      {showRightInsert
                        ? renderInsertPropertyCell(rightInsertKey)
                        : null}
                    </Fragment>
                  )
                })}
                {editable ? <td /> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {editable ? (
          <div
            className="database-page-create-row"
            style={
              {
                "--database-table-min-width": `${tableMinWidth}px`,
              } as CSSProperties
            }
          >
            <button
              className="database-page-create database-page-create-full"
              disabled={!databaseId || addRow.isPending}
              onClick={onAddDatabaseRow}
              type="button"
            >
              {addRow.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              <span>New page</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
