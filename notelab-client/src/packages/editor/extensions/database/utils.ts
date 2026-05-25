import type { DatabaseCell } from "@/features/databases/queries"

export function createDatabaseBlockAttrs(databaseId: string) {
  return {
    databaseId,
  }
}

export function getCellValue(
  cells: DatabaseCell[],
  rowId: string,
  propertyId: string
) {
  const value = cells.find(
    (cell) => cell.rowId === rowId && cell.propertyId === propertyId
  )?.value

  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text

    return typeof text === "string" ? text : ""
  }

  return ""
}
