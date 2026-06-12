import {
  useCallback,
  useMemo,
  useRef,
} from "react"
import { Loader2, Plus } from "lucide-react"
import {
  getColorTokenBadgeClassName,
  getColorTokenDotClassName,
} from "@/packages/editor/components/editor/toolbar-data"

import { defaultStatusOptions } from "../constants"
import { DatabasePageLink } from "../shared/database-page-link"
import { DatabasePropertyValue } from "../shared/database-property-value"
import {
  handleInlineDatabaseScrollWheel,
  useInlineDatabaseScroll,
} from "../shared/use-inline-database-scroll"
import { type DatabasePropertyListItem } from "./database-kanban-config"
import { useDatabaseViewContext } from "../shared/database-view-context"

type DatabaseRow = {
  createdAt: string
  id: string
  page: {
    createdAt?: string
    updatedAt?: string
  }
  pageId: string
  updatedAt: string
}

function getKanbanBoardContentWidth(boardElement: HTMLDivElement) {
  const columns = Array.from(
    boardElement.querySelectorAll<HTMLElement>(".database-kanban-column")
  )

  if (columns.length === 0) {
    return 0
  }

  const firstColumnRect = columns[0]?.getBoundingClientRect()
  const lastColumnRect = columns.at(-1)?.getBoundingClientRect()

  if (!firstColumnRect || !lastColumnRect) {
    return 0
  }

  return lastColumnRect.right - firstColumnRect.left
}

export function DatabaseKanbanView() {
  const {
    propertyValuesByKey,
    databaseId,
    draftPropertyValues,
    editable,
    groupProperty,
    isAddingDatabaseRow,
    showPageIconInTitle,
    addDatabaseRow,
    onOpenPage,
    personOptions,
    items,
    savePropertyValue,
    setActivePropertyValueKey,
    setDraftPropertyValues,
    updateDatabasePropertyConfig,
    visibleProperties,
    options,
  } = useDatabaseViewContext()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const kanbanOptions = useMemo(() => {
    if (!groupProperty) {
      return []
    }

    const hasEmptyColumn = items.some((item: DatabaseRow) => {
      const key = `${item.pageId}:${groupProperty.property.id}`
      const value = propertyValuesByKey[key] ?? ""
      const groupValue = Array.isArray(value) ? value[0] ?? "" : value

      return groupProperty.property.type !== "status" && !groupValue
    })

    return [
      ...options,
      ...(hasEmptyColumn ? [{ color: "gray", id: "empty", name: "Empty" }] : []),
    ]
  }, [groupProperty, items, options, propertyValuesByKey])
  const getInlineKanbanContentWidth = useCallback(() => {
    const boardElement = boardRef.current

    return boardElement ? getKanbanBoardContentWidth(boardElement) : 0
  }, [])
  const {
    isInlineScrollEnabled: isInlineKanbanScrollEnabled,
    style: kanbanWrapStyle,
  } = useInlineDatabaseScroll({
    contentRef: boardRef,
    enabled: Boolean(groupProperty && options.length > 0),
    getContentWidth: getInlineKanbanContentWidth,
    measureKey: kanbanOptions.length,
    wrapperRef: wrapRef,
  })

  const onPropertyConfigChange = (databasePropertyId: string, config: unknown) =>
    updateDatabasePropertyConfig(databasePropertyId, config)
  const renderCardProperty = (
    row: DatabaseRow,
    property: DatabasePropertyListItem,
    disabledSelect = false
  ) => {
    const workspaceProperty = property.property
    const key = `${row.pageId}:${workspaceProperty.id}`
    const persistedValue = propertyValuesByKey[key] ?? ""
    const value = draftPropertyValues[key] ?? persistedValue

    return (
      <div className="database-kanban-property" key={property.id}>
        <div className="database-kanban-property-label">
          {workspaceProperty.name}
        </div>
        <div className="database-kanban-property-value">
          <DatabasePropertyValue
            disabledSelect={disabledSelect}
            draftValues={draftPropertyValues}
            editable={editable}
            onActiveValueChange={setActivePropertyValueKey}
            onDraftValuesChange={setDraftPropertyValues}
            onPropertyConfigChange={onPropertyConfigChange}
            onSaveValue={savePropertyValue}
            persistedValue={persistedValue}
            personOptions={personOptions}
            property={property}
            row={row}
            value={value}
          />
        </div>
      </div>
    )
  }
  return (
    <div
      className="database-kanban-wrap database-inline-scroll-wrap"
      data-inline-scroll={isInlineKanbanScrollEnabled ? "true" : undefined}
      ref={wrapRef}
      style={kanbanWrapStyle}
    >
      {groupProperty && options.length > 0 ? (
        <div
          className="database-kanban-scroll database-inline-scroll"
          onWheel={handleInlineDatabaseScrollWheel}
        >
          <div className="database-kanban-scroll-content database-inline-scroll-content">
            <div className="database-kanban-board" ref={boardRef}>
              {kanbanOptions.map((option) => {
                const isEmptyOption = option.id === "empty"
                const optionItems = items.filter((item: DatabaseRow) => {
                  const key = `${item.pageId}:${groupProperty.property.id}`
                  const value = propertyValuesByKey[key] ?? ""
                  const groupValue = Array.isArray(value) ? value[0] ?? "" : value
                  const normalizedGroupValue =
                    groupValue ||
                    (groupProperty.property.type === "status"
                      ? defaultStatusOptions[0]?.name ?? "Not started"
                      : "")

                  return isEmptyOption
                    ? !groupValue
                    : normalizedGroupValue === option.name
                })

                return (
                  <section className="database-kanban-column" key={option.id}>
                    <div className="database-kanban-column-header">
                      <span className={getColorTokenBadgeClassName(option.color)}>
                        <span
                          aria-hidden="true"
                          className={getColorTokenDotClassName(option.color)}
                        />
                        {option.name}
                      </span>
                      <span className="database-kanban-count">
                        {optionItems.length}
                      </span>
                    </div>
                    <div className="database-kanban-cards">
                      {optionItems.map((item: DatabaseRow) => (
                        <article className="database-kanban-card" key={item.id}>
                          <DatabasePageLink
                            onOpen={onOpenPage}
                            pageId={item.pageId}
                            showPageIcon={showPageIconInTitle}
                          />
                          {visibleProperties.length > 0 ? (
                            <div className="database-kanban-card-properties">
                              {visibleProperties.map(
                                (property: DatabasePropertyListItem) =>
                                  renderCardProperty(
                                    item,
                                    property,
                                    isEmptyOption &&
                                      property.property.id ===
                                        groupProperty.property.id
                                  )
                              )}
                            </div>
                          ) : null}
                        </article>
                      ))}
                      {editable && !isEmptyOption ? (
                        <button
                          className="database-kanban-new-card"
                          disabled={!databaseId || isAddingDatabaseRow}
                          onClick={() => addDatabaseRow(option.name)}
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
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="database-empty-state">
          <span>Add a select or status property to use Kanban.</span>
        </div>
      )}
    </div>
  )
}
