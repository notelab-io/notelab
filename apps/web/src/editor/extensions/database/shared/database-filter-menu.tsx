import { CalendarIcon, Filter, Plus, X } from "lucide-react"
import { useState, type ReactNode } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerSub,
  DropDrawerSubContent,
  DropDrawerSubTrigger,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer"
import { Input } from "@/components/ui/input"
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

import {
  getDatabaseFilterOperatorsForType,
  type DatabasePropertyFilterOperator,
} from "./database-view-config"
import {
  DatabaseSearchableMenuItems,
  type DatabaseSearchableMenuOption,
} from "./database-searchable-menu-items"

export type DatabaseActiveFilter = {
  id: string
  label: string
  operator: DatabasePropertyFilterOperator
  operatorLabel: string
  propertyId: string
  propertyType: string
  values: string[]
}

export type DatabaseFilterUpdatePatch = {
  operator?: DatabasePropertyFilterOperator
  propertyId?: string
  values?: string[]
}

type DatabaseFilterMenuProps = {
  activeDatabaseFilters: DatabaseActiveFilter[]
  addableFilterFieldOptions: DatabaseSearchableMenuOption[]
  canAddDatabaseFilter: boolean
  filterFieldOptions: DatabaseSearchableMenuOption[]
  filterValueOptionsByField: Record<string, DatabaseSearchableMenuOption[]>
  onClearDatabaseFilter: () => void
  onCreateDatabaseFilter: (field: string) => void
  onRemoveDatabaseFilter: (index: number) => void
  onUpdateDatabaseFilter: (index: number, patch: DatabaseFilterUpdatePatch) => void
}

const DEFAULT_RELATIVE_DATE_FILTER_VALUE = "relative:this:week"

const databaseRelativeDateDirections = [
  { label: "Past", value: "past" },
  { label: "Next", value: "next" },
  { label: "This", value: "this" },
] as const

const databaseRelativeDateUnits = [
  { label: "day", value: "day" },
  { label: "week", value: "week" },
  { label: "month", value: "month" },
  { label: "year", value: "year" },
] as const

const dateFilterCalendarClassNames = {
  root: "relative w-full",
  month: "w-full",
  month_grid: "w-full",
  months: "w-full",
}

function filterOperatorNeedsValue(operator: DatabasePropertyFilterOperator) {
  return operator !== "is_empty" && operator !== "is_not_empty"
}

function isDateFilterType(propertyType: string) {
  return (
    propertyType === "date" ||
    propertyType === "created_time" ||
    propertyType === "edited_time"
  )
}

function getFilterInputType(propertyType: string) {
  if (isDateFilterType(propertyType)) {
    return "date"
  }

  return propertyType === "number" ? "number" : "text"
}

function parseRelativeDateFilterValue(value: string | undefined) {
  const [, direction, unit] = (value ?? DEFAULT_RELATIVE_DATE_FILTER_VALUE).split(
    ":"
  )

  return {
    direction: databaseRelativeDateDirections.some(
      (item) => item.value === direction
    )
      ? direction
      : "this",
    unit: databaseRelativeDateUnits.some((item) => item.value === unit)
      ? unit
      : "week",
  }
}

function createRelativeDateFilterValue(direction: string, unit: string) {
  return `relative:${direction}:${unit}`
}

function parseDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const parsedDate = dateValueToDate(trimmedValue)

  return parsedDate ? toDateOnlyValue(parsedDate) : undefined
}

function dateValueToDate(value: string | undefined) {
  if (!value) {
    return null
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])
    const date = new Date(year, month - 1, day)

    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
      ? date
      : null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function toDateOnlyValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDateFilterValueLabel(values: string[]) {
  return values[0]?.slice(0, 10) || "Date"
}

function getDateBetweenFilterValueLabel(values: string[]) {
  const startValue = values[0]?.slice(0, 10)
  const endValue = values[1]?.slice(0, 10)

  if (startValue && endValue) {
    return `${startValue} - ${endValue}`
  }

  return startValue || "Date range"
}

function getNextFilterValuesForOperator(
  filter: DatabaseActiveFilter,
  operator: DatabasePropertyFilterOperator
) {
  if (!filterOperatorNeedsValue(operator)) {
    return []
  }

  if (operator === "is_relative_to_today") {
    return [
      filter.values[0]?.startsWith("relative:")
        ? filter.values[0]
        : DEFAULT_RELATIVE_DATE_FILTER_VALUE,
    ]
  }

  if (operator === "is_between") {
    return filter.values.slice(0, 2)
  }

  return filter.values.slice(0, 1)
}

function DateFilterInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-md border bg-transparent">
      <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={label}
        className="h-8 w-full min-w-0 border-0 bg-transparent pl-7 pr-2 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0"
        onBlur={(event) => onCommit(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onCommit(event.currentTarget.value)
          }
        }}
        placeholder={label}
        value={value}
      />
    </div>
  )
}

function DatabaseDateFilterEditor({
  values,
  onValuesChange,
}: {
  values: string[]
  onValuesChange: (values: string[]) => void
}) {
  const [dateDraft, setDateDraft] = useState<string | null>(null)
  const dateValue = values[0] ?? ""
  const selectedDate = dateValue ? dateValueToDate(dateValue) ?? undefined : undefined

  const commitDateInput = (inputValue: string) => {
    const parsedValue = parseDateInput(inputValue)

    setDateDraft(null)

    if (parsedValue === undefined) {
      return
    }

    onValuesChange(parsedValue === null ? [] : [parsedValue])
  }

  const setSelectedDate = (date: Date | undefined) => {
    if (!date) {
      return
    }

    onValuesChange([toDateOnlyValue(date)])
  }

  return (
    <div className="flex flex-col gap-2">
      <DateFilterInput
        label="Date"
        onChange={setDateDraft}
        onCommit={commitDateInput}
        value={dateDraft ?? dateValue}
      />
      <Calendar
        className="w-full bg-transparent p-1 [--cell-size:2rem]"
        classNames={dateFilterCalendarClassNames}
        mode="single"
        onSelect={setSelectedDate}
        selected={selectedDate}
      />
    </div>
  )
}

function DatabaseDateBetweenFilterEditor({
  values,
  onValuesChange,
}: {
  values: string[]
  onValuesChange: (values: string[]) => void
}) {
  const [startDraft, setStartDraft] = useState<string | null>(null)
  const [endDraft, setEndDraft] = useState<string | null>(null)
  const startValue = values[0] ?? ""
  const endValue = values[1] ?? ""
  const selectedStartDate = startValue
    ? dateValueToDate(startValue) ?? undefined
    : undefined
  const selectedEndDate = endValue ? dateValueToDate(endValue) ?? undefined : undefined

  const commitDateInput = (inputValue: string, field: "end" | "start") => {
    const parsedValue = parseDateInput(inputValue)

    if (field === "start") {
      setStartDraft(null)
    } else {
      setEndDraft(null)
    }

    if (parsedValue === undefined) {
      return
    }

    const nextValues = [...values]

    if (field === "start") {
      nextValues[0] = parsedValue ?? ""
    } else {
      nextValues[1] = parsedValue ?? ""
    }

    onValuesChange(nextValues.filter(Boolean))
  }

  const setSelectedDateRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      return
    }

    onValuesChange([
      toDateOnlyValue(range.from),
      toDateOnlyValue(range.to ?? range.from),
    ])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-1.5">
        <DateFilterInput
          label="Start date"
          onChange={setStartDraft}
          onCommit={(value) => commitDateInput(value, "start")}
          value={startDraft ?? startValue}
        />
        <DateFilterInput
          label="End date"
          onChange={setEndDraft}
          onCommit={(value) => commitDateInput(value, "end")}
          value={endDraft ?? endValue}
        />
      </div>
      <Calendar
        className="w-full bg-transparent p-1 [--cell-size:2rem]"
        classNames={dateFilterCalendarClassNames}
        mode="range"
        onSelect={setSelectedDateRange}
        selected={{ from: selectedStartDate, to: selectedEndDate }}
      />
    </div>
  )
}

function DatabaseRelativeDateFilterEditor({
  value,
  onValueChange,
}: {
  value: string | undefined
  onValueChange: (value: string) => void
}) {
  const relativeDateValue = parseRelativeDateFilterValue(value)

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2">
        <Select
          onValueChange={(direction) =>
            onValueChange(
              createRelativeDateFilterValue(direction, relativeDateValue.unit)
            )
          }
        value={relativeDateValue.direction}
      >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {databaseRelativeDateDirections.map((direction) => (
              <SelectItem key={direction.value} value={direction.value}>
                {direction.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(unit) =>
            onValueChange(
              createRelativeDateFilterValue(relativeDateValue.direction, unit)
            )
          }
          value={relativeDateValue.unit}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {databaseRelativeDateUnits.map((unit) => (
              <SelectItem key={unit.value} value={unit.value}>
                {unit.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
        Filter will update with the current date
      </div>
    </div>
  )
}

function DatabaseDateFilterValueControl({
  filter,
  index,
  onUpdateDatabaseFilter,
}: {
  filter: DatabaseActiveFilter
  index: number
  onUpdateDatabaseFilter: (index: number, patch: DatabaseFilterUpdatePatch) => void
}) {
  const updateValues = (values: string[]) =>
    onUpdateDatabaseFilter(index, { values })

  if (filter.operator === "is_relative_to_today") {
    return (
      <DatabaseRelativeDateFilterEditor
        onValueChange={(value) => updateValues([value])}
        value={filter.values[0]}
      />
    )
  }

  const isBetweenFilter = filter.operator === "is_between"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-8 w-full items-center gap-1.5 rounded-lg border border-input px-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          type="button"
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {isBetweenFilter
              ? getDateBetweenFilterValueLabel(filter.values)
              : getDateFilterValueLabel(filter.values)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-2 p-2">
        {isBetweenFilter ? (
          <DatabaseDateBetweenFilterEditor
            onValuesChange={updateValues}
            values={filter.values}
          />
        ) : (
          <DatabaseDateFilterEditor
            onValuesChange={updateValues}
            values={filter.values}
          />
        )}
        {filter.values.length > 0 ? (
          <Button
            className="h-8 w-full justify-start px-2 text-xs"
            onClick={() => updateValues([])}
            type="button"
            variant="ghost"
          >
            Clear selection
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function DatabaseFilterValueControl({
  filter,
  index,
  onUpdateDatabaseFilter,
  valueOptions,
}: {
  filter: DatabaseActiveFilter
  index: number
  onUpdateDatabaseFilter: (index: number, patch: DatabaseFilterUpdatePatch) => void
  valueOptions: DatabaseSearchableMenuOption[]
}) {
  const setValue = (valueIndex: number, value: string) => {
    const nextValues = [...filter.values]
    nextValues[valueIndex] = value

    onUpdateDatabaseFilter(index, {
      values: nextValues.slice(0, filter.operator === "is_between" ? 2 : 1),
    })
  }

  if (!filterOperatorNeedsValue(filter.operator)) {
    return (
      <span className="inline-flex h-8 w-full items-center rounded-lg border border-transparent px-2 text-sm text-muted-foreground">
        No value
      </span>
    )
  }

  if (filter.operator === "is_relative_to_today") {
    return (
      <DatabaseDateFilterValueControl
        filter={filter}
        index={index}
        onUpdateDatabaseFilter={onUpdateDatabaseFilter}
      />
    )
  }

  if (isDateFilterType(filter.propertyType)) {
    return (
      <DatabaseDateFilterValueControl
        filter={filter}
        index={index}
        onUpdateDatabaseFilter={onUpdateDatabaseFilter}
      />
    )
  }

  if (
    valueOptions.length > 0 &&
    filter.operator !== "is_between" &&
    getFilterInputType(filter.propertyType) === "text"
  ) {
    return (
      <Select
        onValueChange={(value) => onUpdateDatabaseFilter(index, { values: [value] })}
        value={filter.values[0] ?? ""}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Value" />
        </SelectTrigger>
        <SelectContent align="start">
          {valueOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Input
        aria-label={`${filter.label} filter value`}
        className="h-8 min-w-0 flex-1"
        onChange={(event) => setValue(0, event.target.value)}
        placeholder="Value"
        type={getFilterInputType(filter.propertyType)}
        value={filter.values[0] ?? ""}
      />
      {filter.operator === "is_between" ? (
        <Input
          aria-label={`${filter.label} second filter value`}
          className="h-8 min-w-0 flex-1"
          onChange={(event) => setValue(1, event.target.value)}
          placeholder="Value"
          type={getFilterInputType(filter.propertyType)}
          value={filter.values[1] ?? ""}
        />
      ) : null}
    </div>
  )
}

function DatabaseFilterMenuContent({
  activeDatabaseFilters,
  addableFilterFieldOptions,
  canAddDatabaseFilter,
  filterFieldOptions,
  filterValueOptionsByField,
  onClearDatabaseFilter,
  onCreateDatabaseFilter,
  onRemoveDatabaseFilter,
  onUpdateDatabaseFilter,
}: DatabaseFilterMenuProps) {
  const [addFilterPickerOpen, setAddFilterPickerOpen] = useState(false)

  return (
    <div className="flex w-fit max-w-full flex-col gap-2">
      {activeDatabaseFilters.length > 0 ? (
        activeDatabaseFilters.map((filter, index) => {
          const availableFilterOptions = filterFieldOptions.filter(
            (option) =>
              option.value === filter.propertyId ||
              !activeDatabaseFilters.some(
                (activeFilter, activeIndex) =>
                  activeIndex !== index && activeFilter.propertyId === option.value
              )
          )
          const operatorOptions = getDatabaseFilterOperatorsForType(
            filter.propertyType
          )

          return (
            <div
              className="grid max-w-full grid-cols-[1rem_10rem_12rem_16rem_2rem] items-start gap-2"
              key={`${filter.id}:${index}`}
            >
              <Filter className="mt-2 size-4 text-muted-foreground" />
              <Select
                onValueChange={(field) =>
                  onUpdateDatabaseFilter(index, { propertyId: field })
                }
                value={filter.propertyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {availableFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(operator) => {
                  const nextOperator = operator as DatabasePropertyFilterOperator

                  onUpdateDatabaseFilter(index, {
                    operator: nextOperator,
                    values: getNextFilterValuesForOperator(
                      filter,
                      nextOperator
                    ),
                  })
                }}
                value={filter.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {operatorOptions.map((operator) => (
                    <SelectItem key={operator.value} value={operator.value}>
                      {operator.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatabaseFilterValueControl
                filter={filter}
                index={index}
                onUpdateDatabaseFilter={onUpdateDatabaseFilter}
                valueOptions={filterValueOptionsByField[filter.propertyId] ?? []}
              />
              <button
                aria-label={`Remove ${filter.label} filter`}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => onRemoveDatabaseFilter(index)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })
      ) : (
        <div className="rounded-md px-2 py-1.5 text-sm text-muted-foreground">
          No filters yet
        </div>
      )}
      {canAddDatabaseFilter ? (
        <DropDrawer
          open={addFilterPickerOpen}
          onOpenChange={setAddFilterPickerOpen}
        >
          <DropDrawerTrigger asChild>
            <button
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
            >
              <Plus className="size-4" />
              <span>Add filter</span>
            </button>
          </DropDrawerTrigger>
          <DropDrawerContent
            align="start"
            className="w-72"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DatabaseSearchableMenuItems
              emptyMessage="No properties available."
              inputAriaLabel="Add filter property"
              inputIcon={<Filter className="size-4" />}
              inputPlaceholder="Filter by..."
              onSelect={(field) => {
                onCreateDatabaseFilter(field)
                setAddFilterPickerOpen(false)
              }}
              open={addFilterPickerOpen}
              options={addableFilterFieldOptions}
            />
          </DropDrawerContent>
        </DropDrawer>
      ) : null}
      <button
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        disabled={activeDatabaseFilters.length === 0}
        onClick={onClearDatabaseFilter}
        type="button"
      >
        <X className="size-4" />
        <span>Delete filters</span>
      </button>
    </div>
  )
}

export function DatabaseFilterPopover({
  activeDatabaseFilters,
  addableFilterFieldOptions,
  canAddDatabaseFilter,
  children,
  filterFieldOptions,
  filterValueOptionsByField,
  onClearDatabaseFilter,
  onCreateDatabaseFilter,
  onRemoveDatabaseFilter,
  onUpdateDatabaseFilter,
}: DatabaseFilterMenuProps & {
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-fit min-w-0 max-w-[calc(100vw-2rem)] gap-2 p-2"
      >
        <DatabaseFilterMenuContent
          activeDatabaseFilters={activeDatabaseFilters}
          addableFilterFieldOptions={addableFilterFieldOptions}
          canAddDatabaseFilter={canAddDatabaseFilter}
          filterFieldOptions={filterFieldOptions}
          filterValueOptionsByField={filterValueOptionsByField}
          onClearDatabaseFilter={onClearDatabaseFilter}
          onCreateDatabaseFilter={onCreateDatabaseFilter}
          onRemoveDatabaseFilter={onRemoveDatabaseFilter}
          onUpdateDatabaseFilter={onUpdateDatabaseFilter}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DatabaseFilterSubmenu({
  activeDatabaseFilters,
  addableFilterFieldOptions,
  canAddDatabaseFilter,
  children,
  filterFieldOptions,
  filterValueOptionsByField,
  onClearDatabaseFilter,
  onCreateDatabaseFilter,
  onRemoveDatabaseFilter,
  onUpdateDatabaseFilter,
}: DatabaseFilterMenuProps & {
  children: ReactNode
}) {
  return (
    <DropDrawerSub>
      <DropDrawerSubTrigger>{children}</DropDrawerSubTrigger>
      <DropDrawerSubContent className="w-fit max-w-[calc(100vw-2rem)] p-2">
        <DatabaseFilterMenuContent
          activeDatabaseFilters={activeDatabaseFilters}
          addableFilterFieldOptions={addableFilterFieldOptions}
          canAddDatabaseFilter={canAddDatabaseFilter}
          filterFieldOptions={filterFieldOptions}
          filterValueOptionsByField={filterValueOptionsByField}
          onClearDatabaseFilter={onClearDatabaseFilter}
          onCreateDatabaseFilter={onCreateDatabaseFilter}
          onRemoveDatabaseFilter={onRemoveDatabaseFilter}
          onUpdateDatabaseFilter={onUpdateDatabaseFilter}
        />
      </DropDrawerSubContent>
    </DropDrawerSub>
  )
}
