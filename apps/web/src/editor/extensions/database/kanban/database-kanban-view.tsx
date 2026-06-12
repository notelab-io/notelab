import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  cyclingColorTokens,
  getColorTokenBadgeClassName,
  getColorTokenDotClassName,
} from "@/packages/editor/components/editor/toolbar-data"

import { defaultStatusOptions } from "../constants"
import { DatabasePropertyInput } from "../database-property-input"
import { DatabasePageLink } from "../shared/database-page-link"
import { DatabasePropertyValue } from "../shared/database-property-value"
import type { DatabasePropertyValue as DatabaseCellValue } from "../utils"
import {
  getMergedPropertyConfig,
  type DatabasePropertyConfig,
} from "../shared/database-view-config"
import {
  useInlineDatabaseScroll,
} from "../shared/use-inline-database-scroll"
import {
  type DatabasePropertyListItem,
  type DatabaseSelectOption,
} from "./database-kanban-config"
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

type SelectOptionSortValue = "manual" | "alphabetical" | "reverse_alphabetical"

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

function getNextOptionColor(options: DatabaseSelectOption[]) {
  return (
    cyclingColorTokens[options.length % cyclingColorTokens.length]?.value ??
    "default"
  )
}

function getSelectOptionSort(config: unknown): SelectOptionSortValue {
  if (!config || typeof config !== "object" || !("selectOptionSort" in config)) {
    return "manual"
  }

  const selectOptionSort = (config as DatabasePropertyConfig).selectOptionSort

  return selectOptionSort === "alphabetical" ||
    selectOptionSort === "reverse_alphabetical"
    ? selectOptionSort
    : "manual"
}

function getSortedSelectOptions(
  options: DatabaseSelectOption[],
  sort: SelectOptionSortValue
) {
  if (sort === "manual") {
    return options
  }

  const sortedOptions = [...options].sort((firstOption, secondOption) =>
    firstOption.name.localeCompare(secondOption.name, undefined, {
      sensitivity: "base",
    })
  )

  return sort === "reverse_alphabetical"
    ? sortedOptions.reverse()
    : sortedOptions
}

function getKanbanGroupValues(
  value: DatabaseCellValue,
  propertyType: string
) {
  const values = Array.isArray(value) ? value : value ? [value] : []
  const groupValues = values.map((item) => item.trim()).filter(Boolean)

  if (groupValues.length > 0) {
    return groupValues
  }

  return propertyType === "status"
    ? [defaultStatusOptions[0]?.name ?? "Not started"].filter(Boolean)
    : []
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
    filteredItems: items,
    savePropertyValue,
    setActivePropertyValueKey,
    setDraftPropertyValues,
    updateDatabasePropertyConfig,
    visibleProperties,
    options,
  } = useDatabaseViewContext()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [newKanbanOptionName, setNewKanbanOptionName] = useState("")
  const [isCreatingKanbanOption, setIsCreatingKanbanOption] = useState(false)
  const kanbanOptions = useMemo(() => {
    if (!groupProperty) {
      return []
    }

    const hasEmptyColumn = items.some((item: DatabaseRow) => {
      const key = `${item.pageId}:${groupProperty.property.id}`
      const value = propertyValuesByKey[key] ?? ""
      const groupValues = getKanbanGroupValues(
        value,
        groupProperty.property.type
      )

      return groupProperty.property.type !== "status" && groupValues.length === 0
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
    enabled: Boolean(groupProperty),
    getContentWidth: getInlineKanbanContentWidth,
    measureKey: `${kanbanOptions.length}:${editable}`,
    scrollRef,
    wrapperRef: wrapRef,
  })

  const createKanbanOption = async () => {
    const optionName = newKanbanOptionName.trim()

    if (!groupProperty || !optionName || isCreatingKanbanOption) {
      setNewKanbanOptionName("")
      return
    }

    const hasMatchingOption = options.some(
      (option) => option.name.toLowerCase() === optionName.toLowerCase()
    )

    if (hasMatchingOption) {
      setNewKanbanOptionName("")
      return
    }

    const createdOption = {
      color: getNextOptionColor(options),
      id: crypto.randomUUID(),
      name: optionName,
    }
    const nextOptions = [
      ...options,
      createdOption,
    ]
    const sortedOptions = getSortedSelectOptions(
      nextOptions,
      getSelectOptionSort(groupProperty.property.config)
    )

    setIsCreatingKanbanOption(true)

    try {
      await updateDatabasePropertyConfig(
        groupProperty.id,
        getMergedPropertyConfig(groupProperty.property.config, {
          options: sortedOptions,
        })
      )
      addDatabaseRow(createdOption.name, groupProperty)
      setNewKanbanOptionName("")
    } catch {
      toast.error("Couldn't create group")
    } finally {
      setIsCreatingKanbanOption(false)
    }
  }

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
      {groupProperty ? (
        <div
          className="database-kanban-scroll database-inline-scroll"
          ref={scrollRef}
        >
          <div className="database-kanban-scroll-content database-inline-scroll-content">
            <div className="database-kanban-board" ref={boardRef}>
              {kanbanOptions.map((option) => {
                const isEmptyOption = option.id === "empty"
                const optionItems = items.filter((item: DatabaseRow) => {
                  const key = `${item.pageId}:${groupProperty.property.id}`
                  const value = propertyValuesByKey[key] ?? ""
                  const groupValues = getKanbanGroupValues(
                    value,
                    groupProperty.property.type
                  )

                  return isEmptyOption
                    ? groupValues.length === 0
                    : groupValues.includes(option.name)
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
              {editable ? (
                <section className="database-kanban-column database-kanban-new-column">
                  <div className="database-kanban-column-header database-kanban-new-column-header">
                    <div
                      className="database-kanban-new-group-input"
                      onClick={(event) => {
                        if (
                          event.target instanceof HTMLElement &&
                          event.target.closest(".database-input-cell-trigger")
                        ) {
                          return
                        }

                        event.currentTarget
                          .querySelector<HTMLButtonElement>(
                            ".database-input-cell-trigger"
                          )
                          ?.click()
                      }}
                    >
                      {isCreatingKanbanOption || isAddingDatabaseRow ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus aria-hidden="true" />
                      )}
                      <DatabasePropertyInput
                        editable={!isCreatingKanbanOption}
                        label="New group"
                        onChange={setNewKanbanOptionName}
                        onCommit={() => {
                          void createKanbanOption()
                        }}
                        type="text"
                        value={newKanbanOptionName}
                      />
                    </div>
                  </div>
                  <div className="database-kanban-cards" />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="database-empty-state">
          <span>Add a select, multi-select, or status property to use Kanban.</span>
        </div>
      )}
    </div>
  )
}
