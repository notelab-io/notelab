import {
  serializePropertyValue,
  type DatabasePropertyValue,
} from "../utils"
import type {
  DatabaseSortConfig,
  DatabaseSortDirection,
} from "./database-view-config"

export type SortableDatabaseItem = {
  createdAt: string
  id: string
  page: {
    name: string
    createdAt?: string
    updatedAt?: string
  }
  pageId: string
  position: number
  updatedAt: string
}

type SortableDatabaseProperty = {
  id: string
  property: {
    id: string
    type: string
  }
}

export function hasViewHiddenPropertyIds(config: unknown) {
  return (
    config !== null &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    "hiddenPropertyIds" in config
  )
}

function getReadOnlyTimePropertySortValue(
  item: {
    createdAt: string
    page: {
      createdAt?: string
      updatedAt?: string
    }
    updatedAt: string
  },
  type: string
) {
  return type === "created_time"
    ? item.page.createdAt ?? item.createdAt
    : item.page.updatedAt ?? item.updatedAt
}

function isEmptySortValue(value: number | string | null) {
  return value === null || value === ""
}

function compareSortValues(
  firstValue: number | string | null,
  secondValue: number | string | null,
  direction: DatabaseSortDirection
) {
  const firstIsEmpty = isEmptySortValue(firstValue)
  const secondIsEmpty = isEmptySortValue(secondValue)

  if (firstIsEmpty || secondIsEmpty) {
    if (firstIsEmpty && secondIsEmpty) {
      return 0
    }

    return firstIsEmpty ? 1 : -1
  }

  let comparison = 0

  if (typeof firstValue === "number" && typeof secondValue === "number") {
    comparison = firstValue - secondValue
  } else {
    comparison = String(firstValue).localeCompare(String(secondValue), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return direction === "descending" ? comparison * -1 : comparison
}

function getComparableDateValue(
  value: DatabasePropertyValue | string | null | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] ?? "" : value
  const timestamp = rawValue ? new Date(rawValue).getTime() : Number.NaN

  return Number.isFinite(timestamp) ? timestamp : null
}

function getComparableNumberValue(value: DatabasePropertyValue) {
  const rawValue = Array.isArray(value) ? value[0] ?? "" : value
  const parsedValue = rawValue.trim() ? Number(rawValue) : Number.NaN

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function getComparablePersonValue(
  value: DatabasePropertyValue,
  personOptionsById: Map<string, string>
) {
  const personIds = Array.isArray(value) ? value : value ? [value] : []

  return personIds
    .map((personId) => personOptionsById.get(personId) ?? personId)
    .join(", ")
}

function getComparablePropertyValue(
  item: SortableDatabaseItem,
  property: SortableDatabaseProperty,
  propertyValuesByKey: Record<string, DatabasePropertyValue>,
  personOptionsById: Map<string, string>
) {
  const propertyValue = propertyValuesByKey[`${item.pageId}:${property.property.id}`] ?? ""

  switch (property.property.type) {
    case "checkbox":
      return propertyValue === "true" ? 1 : 0
    case "created_time":
    case "edited_time":
      return getComparableDateValue(
        getReadOnlyTimePropertySortValue(item, property.property.type)
      )
    case "date":
      return getComparableDateValue(propertyValue)
    case "number":
      return getComparableNumberValue(propertyValue)
    case "person":
      return getComparablePersonValue(propertyValue, personOptionsById)
    default:
      return Array.isArray(propertyValue) ? propertyValue.join(", ") : propertyValue
  }
}

export function getSortedDatabaseItems(
  items: SortableDatabaseItem[],
  properties: SortableDatabaseProperty[],
  propertyValuesByKey: Record<string, DatabasePropertyValue>,
  sorts: DatabaseSortConfig[],
  personOptionsById: Map<string, string>
) {
  if (sorts.length === 0) {
    return items
  }

  return [...items].sort((firstItem, secondItem) => {
    for (const sort of sorts) {
      const comparison =
        sort.column === "name"
          ? compareSortValues(
              firstItem.page.name.trim(),
              secondItem.page.name.trim(),
              sort.direction
            )
          : (() => {
              const sortedProperty = properties.find(
                (property) => property.id === sort.column
              )

              if (!sortedProperty) {
                return 0
              }

              return compareSortValues(
                getComparablePropertyValue(
                  firstItem,
                  sortedProperty,
                  propertyValuesByKey,
                  personOptionsById
                ),
                getComparablePropertyValue(
                  secondItem,
                  sortedProperty,
                  propertyValuesByKey,
                  personOptionsById
                ),
                sort.direction
              )
            })()

      if (comparison !== 0) {
        return comparison
      }
    }

    return firstItem.position - secondItem.position
  })
}

export function areSerializedPropertyValuesEqual(
  propertyType: string,
  currentValue: DatabasePropertyValue,
  nextValue: DatabasePropertyValue
) {
  return (
    JSON.stringify(serializePropertyValue(propertyType, currentValue)) ===
    JSON.stringify(serializePropertyValue(propertyType, nextValue))
  )
}
