import { useMemo } from "react"
import {
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
} from "@/components/kibo-ui/gantt"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { defaultStatusOptions, getDatabasePropertyType } from "../constants"
import { formatDatabaseDateValue } from "../shared/database-date-config"
import { getRawDatabaseGroupValue } from "../shared/database-group-values"
import { useDatabaseViewContext } from "../shared/database-view-context"
import {
  buildTimelineRowItem,
  getGanttStatusForValue,
  getTimelineDatePropertyId,
  groupTimelineRows,
  ganttMoveToCellValue,
  UNSCHEDULED_GROUP_NAME,
  type TimelineRowItem,
} from "./database-timeline-config"

function getTimelineGroupLabel({
  groupValue,
  property,
}: {
  groupValue: string
  property: NonNullable<
    ReturnType<typeof useDatabaseViewContext>["groupProperty"]
  >
}) {
  if (!groupValue) {
    return "Empty"
  }

  if (property.property.type === "checkbox") {
    return groupValue === "true" ? "Checked" : "Unchecked"
  }

  if (property.property.type === "date") {
    return (
      formatDatabaseDateValue(groupValue, property.property.config) || groupValue
    )
  }

  return groupValue
}

function getTimelineGroupName({
  groupProperty,
  row,
  values,
}: {
  groupProperty: ReturnType<typeof useDatabaseViewContext>["groupProperty"]
  row: ReturnType<typeof useDatabaseViewContext>["sortedItems"][number]
  values: ReturnType<typeof useDatabaseViewContext>["propertyValuesByKey"]
}) {
  if (!groupProperty) {
    return "All items"
  }

  if (groupProperty.id === "name") {
    return row.page.name?.trim() || "Empty"
  }

  const key = `${row.pageId}:${groupProperty.property.id}`
  const rawValue = getRawDatabaseGroupValue(values[key] ?? "")

  if (!rawValue && groupProperty.property.type === "status") {
    return defaultStatusOptions[0]?.name ?? "Not started"
  }

  return getTimelineGroupLabel({
    groupValue: rawValue,
    property: groupProperty,
  })
}

function TimelineUnscheduledSidebarItem({
  item,
  onSelect,
}: {
  item: TimelineRowItem
  onSelect: (id: string) => void
}) {
  return (
    <button
      className="relative flex w-full items-center gap-2.5 p-2.5 text-left text-xs hover:bg-secondary"
      onClick={() => onSelect(item.id)}
      style={{ height: "var(--gantt-row-height)" }}
      type="button"
    >
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: item.status.color }}
      />
      <p className="flex-1 truncate font-medium">{item.name}</p>
      <p className="text-muted-foreground">Unscheduled</p>
    </button>
  )
}

export function DatabaseTimelineView() {
  const {
    activeView,
    groupProperty,
    onOpenPage,
    properties,
    propertyValuesByKey,
    savePropertyValue,
    setViewDateProperty,
    sortedItems,
    timelineDateProperties,
    timelineDateProperty,
    addTimelineRow,
  } = useDatabaseViewContext()

  const statusProperty =
    properties.find((property) => property.property.type === "status") ?? null
  const configuredDatePropertyId = getTimelineDatePropertyId(activeView?.config)

  const groupedTimelineRows = useMemo(() => {
    if (!timelineDateProperty) {
      return []
    }

    const rows = sortedItems.map((row) => {
      const dateValue = propertyValuesByKey[
        `${row.pageId}:${timelineDateProperty.property.id}`
      ] ?? ""
      const statusValue = statusProperty
        ? getRawDatabaseGroupValue(
            propertyValuesByKey[`${row.pageId}:${statusProperty.property.id}`] ??
              ""
          )
        : ""
      const groupName = getTimelineGroupName({
        groupProperty,
        row,
        values: propertyValuesByKey,
      })
      const status = getGanttStatusForValue(statusValue, statusProperty)
      const timelineRow = buildTimelineRowItem({
        dateValue,
        groupName: timelineDateProperty ? groupName : UNSCHEDULED_GROUP_NAME,
        rowId: row.id,
        rowName: row.page.name ?? "Untitled",
        pageId: row.pageId,
        status,
      })

      return {
        ...timelineRow,
        groupName: timelineRow.feature ? groupName : UNSCHEDULED_GROUP_NAME,
      }
    })

    return groupTimelineRows(rows)
  }, [
    groupProperty,
    propertyValuesByKey,
    sortedItems,
    statusProperty,
    timelineDateProperty,
  ])

  const handleSelectRow = (rowId: string) => {
    const row = sortedItems.find((item) => item.id === rowId)

    if (row?.pageId) {
      onOpenPage?.(row.pageId)
    }
  }

  const handleMoveFeature = (id: string, startAt: Date, endAt: Date | null) => {
    if (!timelineDateProperty) {
      return
    }

    const row = sortedItems.find((item) => item.id === id)

    if (!row) {
      return
    }

    const key = `${row.pageId}:${timelineDateProperty.property.id}`
    const currentValue = propertyValuesByKey[key] ?? ""
    savePropertyValue(
      row.id,
      timelineDateProperty.property.id,
      "date",
      currentValue,
      ganttMoveToCellValue(startAt, endAt)
    )
  }

  if (!timelineDateProperty) {
    return (
      <div className="database-empty-state flex flex-col items-center gap-3 px-6 py-10 text-sm text-muted-foreground">
        <span>Schedule this timeline view by</span>
        <Select
          onValueChange={setViewDateProperty}
          value={configuredDatePropertyId ?? undefined}
        >
          <SelectTrigger className="min-w-56">
            <SelectValue placeholder="Choose a date property" />
          </SelectTrigger>
          <SelectContent align="center">
            {timelineDateProperties.map((property) => {
              const PropertyIcon = getDatabasePropertyType(property.property.type)
                .icon

              return (
                <SelectItem key={property.id} value={property.property.id}>
                  <PropertyIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span>{property.property.name}</span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="database-timeline-view min-h-0 flex-1 overflow-hidden">
      <GanttProvider
        className="h-full min-h-[28rem] border"
        onAddItem={addTimelineRow}
        range="monthly"
        zoom={100}
      >
        <GanttSidebar>
          {groupedTimelineRows.map((group) => (
            <GanttSidebarGroup key={group.groupName} name={group.groupName}>
              {group.items.map((item) =>
                item.feature ? (
                  <GanttSidebarItem
                    feature={item.feature}
                    key={item.id}
                    onSelectItem={handleSelectRow}
                  />
                ) : (
                  <TimelineUnscheduledSidebarItem
                    item={item}
                    key={item.id}
                    onSelect={handleSelectRow}
                  />
                )
              )}
            </GanttSidebarGroup>
          ))}
        </GanttSidebar>
        <GanttTimeline>
          <GanttHeader />
          <GanttFeatureList>
            {groupedTimelineRows.map((group) => (
              <GanttFeatureListGroup key={group.groupName}>
                {group.items.map((item) =>
                  item.feature ? (
                    <div className="flex" key={item.id}>
                      <button
                        className="w-full"
                        onClick={() => handleSelectRow(item.id)}
                        type="button"
                      >
                        <GanttFeatureItem
                          {...item.feature}
                          onMove={handleMoveFeature}
                        >
                          <p className="flex-1 truncate text-xs">{item.name}</p>
                        </GanttFeatureItem>
                      </button>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      style={{ height: "var(--gantt-row-height)" }}
                    />
                  )
                )}
              </GanttFeatureListGroup>
            ))}
          </GanttFeatureList>
          <GanttToday />
        </GanttTimeline>
      </GanttProvider>
    </div>
  )
}