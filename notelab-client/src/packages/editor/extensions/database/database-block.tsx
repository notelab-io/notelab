import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { GripVertical, Loader2, Plus } from "lucide-react"
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useAddDatabaseProperty,
  useAddDatabaseRow,
  useDatabase,
  useReorderDatabaseRows,
  useUpdateDatabase,
  useUpdateDatabaseCell,
  useUpdateDatabaseProperty,
} from "@/features/databases/hooks"

import { AddDatabasePropertyMenu } from "./add-database-property-menu"
import {
  DATABASE_PAGE_DRAG_MIME,
  databaseAddPropertyColumnDefaultWidth,
  databaseColumnMinWidth,
  databaseNameColumnDefaultWidth,
} from "./constants"
import { DatabasePageCell } from "./database-page-cell"
import { DatabasePropertyMenu } from "./database-property-menu"
import { DatabaseSelectCell } from "./database-select-cell"
import type { DatabaseBlockOptions } from "./types"
import { getCellValue } from "./utils"

const databasePageDragEvents = new Set([
  "dragstart",
  "dragenter",
  "dragover",
  "dragleave",
  "drop",
  "dragend",
])

function isDatabasePageDragEvent(event: Event) {
  if (!databasePageDragEvents.has(event.type) || !(event instanceof DragEvent)) {
    return false
  }

  return Array.from(event.dataTransfer?.types ?? []).includes(
    DATABASE_PAGE_DRAG_MIME
  )
}

function DatabaseBlockView({ extension, node }: ReactNodeViewProps) {
  const options = extension.options as DatabaseBlockOptions
  const databaseId = node.attrs.databaseId as string | null
  const [draftCells, setDraftCells] = useState<Record<string, string>>({})
  const updateDatabase = useUpdateDatabase()
  const addProperty = useAddDatabaseProperty()
  const updateProperty = useUpdateDatabaseProperty()
  const addRow = useAddDatabaseRow(options.organizationId)
  const reorderRows = useReorderDatabaseRows()
  const updateCell = useUpdateDatabaseCell()
  const { data: payload, isLoading } = useDatabase(databaseId)
  const [draftTitle, setDraftTitle] = useState("New database")
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)
  const [rowDropTargetIndex, setRowDropTargetIndex] = useState<number | null>(
    null
  )

  const cells = payload?.cells ?? []
  const properties = payload?.properties ?? []
  const rows = payload?.rows ?? []
  const rowDragHandleTop = (index: number) => 32 + index * 32 + 16
  const rowDropLineTop = (index: number) => 32 + index * 32
  const columnKeys = useMemo(
    () => ["name", ...properties.map((property) => property.id), "add-property"],
    [properties]
  )
  const getColumnWidth = (key: string) =>
    columnWidths[key] ??
    (key === "name"
      ? databaseNameColumnDefaultWidth
      : key === "add-property"
        ? databaseAddPropertyColumnDefaultWidth
        : databaseColumnMinWidth)
  const tableMinWidth = columnKeys.reduce(
    (width, key) => width + getColumnWidth(key),
    0
  )

  useEffect(() => {
    if (payload?.database.name) {
      setDraftTitle(payload.database.name)
    }
  }, [payload?.database.id, payload?.database.name])

  const cellValues = useMemo(() => {
    const values: Record<string, string> = {}

    for (const row of rows) {
      for (const property of properties) {
        values[`${row.id}:${property.id}`] = getCellValue(
          cells,
          row.id,
          property.id
        )
      }
    }

    return values
  }, [cells, properties, rows])

  const addDatabaseRow = () => {
    if (!databaseId || addRow.isPending) {
      return
    }

    addRow.mutate({
      databaseId,
      title: "Untitled",
    })
  }

  const addDatabaseProperty = (type = "text", label = "Property") => {
    if (!databaseId || addProperty.isPending) {
      return
    }

    addProperty.mutate({
      databaseId,
      name: label,
      type,
    })
  }

  const saveCell = (rowId: string, propertyId: string, value: string) => {
    if (!databaseId) {
      return
    }

    updateCell.mutate({
      databaseId,
      propertyId,
      rowId,
      value: { text: value },
    })
  }

  const resizeCellEditor = (element: HTMLTextAreaElement) => {
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }

  const handleCellInput = (event: FormEvent<HTMLTextAreaElement>) => {
    resizeCellEditor(event.currentTarget)
  }

  const startColumnResize = (
    columnKey: string,
    event: PointerEvent<HTMLSpanElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getColumnWidth(columnKey)

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = Math.max(
        databaseColumnMinWidth,
        startWidth + moveEvent.clientX - startX
      )

      setColumnWidths((widths) => ({
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

  const getRowDropTargetIndex = (clientY: number) => {
    const rowElements = Array.from(
      document.querySelectorAll<HTMLTableRowElement>(
        `[data-database-id="${databaseId}"] .database-table tbody tr[data-database-row-id]`
      )
    )

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
    if (!databaseId || !draggedRowId || rowDropTargetIndex === null) {
      return
    }

    const sourceIndex = rows.findIndex((row) => row.id === draggedRowId)

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

    const rowIds = nextRows.map((row) => row.id)

    if (rowIds.every((rowId, index) => rowId === rows[index]?.id)) {
      return
    }

    reorderRows.mutate({ databaseId, rowIds })
  }

  const clearRowDrag = () => {
    setDraggedRowId(null)
    setRowDropTargetIndex(null)
  }

  return (
    <NodeViewWrapper
      className="database-block"
      data-database-id={databaseId ?? undefined}
      data-type="databaseBlock"
    >
      <div className="database-block-shell" contentEditable={false}>
        <div className="database-toolbar">
          <Input
            aria-label="Database title"
            className="database-title-input h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-semibold leading-tight text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:border-transparent focus-visible:ring-0 md:text-2xl dark:bg-transparent"
            disabled={!databaseId}
            onBlur={(event) => {
              if (databaseId && event.target.value !== payload?.database.name) {
                updateDatabase.mutate({
                  databaseId,
                  name: event.target.value,
                })
              }
            }}
            onChange={(event) => {
              setDraftTitle(event.target.value)
            }}
            placeholder="New database"
            value={draftTitle}
          />
          <Button
            className="database-new-button"
            disabled={!databaseId || addRow.isPending}
            onClick={addDatabaseRow}
            type="button"
          >
            {addRow.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            <span>New</span>
          </Button>
        </div>
        {!databaseId ? (
          <div className="database-empty-state">
            <span>Database reference missing.</span>
          </div>
        ) : isLoading || !payload ? (
          <div className="database-empty-state">
            <Loader2 className="animate-spin" />
            <span>Loading database...</span>
          </div>
        ) : (
          <div
            className="database-table-wrap"
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as globalThis.Node | null
                )
              ) {
                setRowDropTargetIndex(null)
              }
            }}
            onDragOver={(event) => {
              if (!draggedRowId) {
                return
              }

              event.preventDefault()
              event.dataTransfer.dropEffect = "move"
              setRowDropTargetIndex(getRowDropTargetIndex(event.clientY))
            }}
            onDrop={(event) => {
              if (!draggedRowId || rowDropTargetIndex === null) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              moveDraggedRow()
              clearRowDrag()
            }}
          >
            <div className="database-row-drag-rail">
              {rows.map((row, index) => (
                <button
                  aria-label={`Drag ${row.title.trim() || "Untitled"}`}
                  className="database-row-drag-handle"
                  data-visible={hoveredRowId === row.id ? "true" : undefined}
                  draggable
                  key={row.id}
                  onClick={(event) => event.preventDefault()}
                  onDragStart={(event) => {
                    setDraggedRowId(row.id)
                    setRowDropTargetIndex(index)
                    event.dataTransfer.effectAllowed = "copyMove"
                    event.dataTransfer.setData(
                      DATABASE_PAGE_DRAG_MIME,
                      JSON.stringify({
                        databaseId: payload.database.id,
                        pageId: row.pageId,
                        rowId: row.id,
                      })
                    )
                    event.dataTransfer.setData(
                      "text/plain",
                      row.title.trim() || "Untitled"
                    )
                  }}
                  onDragEnd={clearRowDrag}
                  onMouseEnter={() => setHoveredRowId(row.id)}
                  onMouseLeave={() =>
                    setHoveredRowId((currentId) =>
                      currentId === row.id ? null : currentId
                    )
                  }
                  style={{
                    top: rowDragHandleTop(index),
                  }}
                  title="Drag page"
                  type="button"
                >
                  <GripVertical />
                </button>
              ))}
            </div>
            {rowDropTargetIndex !== null ? (
              <div
                className="database-row-drop-line"
                style={{ top: rowDropLineTop(rowDropTargetIndex) }}
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
                  <col key={key} style={{ width: getColumnWidth(key) }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="database-name-header">
                    <span className="database-name-header-content">
                      <span>Aa</span>
                      <span>Name</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="database-column-resize-handle"
                      onPointerDown={(event) => startColumnResize("name", event)}
                    />
                  </th>
                  {properties.map((property) => (
                    <th key={property.id} className="database-property-header">
                      <DatabasePropertyMenu
                        name={property.name}
                        type={property.type}
                        onRename={(name) =>
                          updateProperty.mutate({
                            databaseId: payload.database.id,
                            name,
                            propertyId: property.id,
                          })
                        }
                      />
                      <span
                        aria-hidden="true"
                        className="database-column-resize-handle"
                        onPointerDown={(event) =>
                          startColumnResize(property.id, event)
                        }
                      />
                    </th>
                  ))}
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    data-database-row-id={row.id}
                    key={row.id}
                    onMouseEnter={() => setHoveredRowId(row.id)}
                    onMouseLeave={() =>
                      setHoveredRowId((currentId) =>
                        currentId === row.id ? null : currentId
                      )
                    }
                  >
                    <td className="database-page-cell">
                      <DatabasePageCell
                        onOpen={options.onOpenPage}
                        pageId={row.pageId}
                      />
                    </td>
                    {properties.map((property) => {
                      const key = `${row.id}:${property.id}`
                      const value = draftCells[key] ?? cellValues[key] ?? ""
                      const isSelectProperty = property.type === "select"

                      return (
                        <td
                          className="database-value-cell"
                          data-active={activeCellKey === key ? "true" : undefined}
                          key={property.id}
                        >
                          {isSelectProperty ? (
                            <DatabaseSelectCell
                              databaseId={payload.database.id}
                              onSelect={(optionName) =>
                                saveCell(row.id, property.id, optionName)
                              }
                              propertyConfig={property.config}
                              propertyId={property.id}
                              propertyName={property.name}
                              value={value}
                            />
                          ) : (
                            <textarea
                              aria-label={`${property.name} value`}
                              className="database-cell-input"
                              onBlur={(event) => {
                                saveCell(
                                  row.id,
                                  property.id,
                                  event.currentTarget.value
                                )
                                event.currentTarget.style.height = ""
                                setActiveCellKey((currentKey) =>
                                  currentKey === key ? null : currentKey
                                )
                                setDraftCells((drafts) => {
                                  const nextDrafts = { ...drafts }

                                  delete nextDrafts[key]

                                  return nextDrafts
                                })
                              }}
                              onChange={(event) =>
                                setDraftCells((drafts) => ({
                                  ...drafts,
                                  [key]: event.target.value,
                                }))
                              }
                              onFocus={(event) => {
                                setActiveCellKey(key)
                                resizeCellEditor(event.currentTarget)
                              }}
                              onInput={handleCellInput}
                              rows={1}
                              value={value}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                ))}
                <tr>
                  <td className="database-page-cell">
                    <button
                      className="database-page-create"
                      disabled={!databaseId || addRow.isPending}
                      onClick={addDatabaseRow}
                      type="button"
                    >
                      {addRow.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      <span>New page</span>
                    </button>
                  </td>
                  {properties.map((property) => (
                    <td key={property.id} />
                  ))}
                  <td />
                </tr>
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const DatabaseBlock = Node.create<DatabaseBlockOptions>({
  name: "databaseBlock",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  extendNodeSchema(extension) {
    if (extension.name !== this.name) {
      return {}
    }

    return {
      disableDropCursor: (
        _view: unknown,
        _pos: unknown,
        event: DragEvent
      ) => isDatabasePageDragEvent(event),
    }
  },

  addOptions() {
    return {
      currentPageId: null,
      onOpenPage: undefined,
      organizationId: null,
    }
  },

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-database-id"),
        renderHTML: (attributes) =>
          attributes.databaseId ? { "data-database-id": attributes.databaseId } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="databaseBlock"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "databaseBlock" }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target

        if (
          target instanceof HTMLElement &&
          target.closest(".database-row-drag-handle")
        ) {
          return true
        }

        return isDatabasePageDragEvent(event)
      },
    })
  },
})
