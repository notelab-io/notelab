import type {
  DatabasePayload,
  DatabaseRow,
  DatabaseRowsPagination,
  WorkspacePropertyValue,
} from "./queries"

export const DEFAULT_DATABASE_ROWS_PAGE_SIZE = 100

export type DatabaseRowsPage = {
  hasMore: boolean
  nextCursor: number | null
  rows: DatabaseRow[]
  values: WorkspacePropertyValue[]
}

export function isDatabasePayloadComplete(payload: DatabasePayload) {
  return payload.rowsPagination?.hasMore !== true
}

export function createInitialPaginatedPayload(
  schema: DatabasePayload,
  page: DatabaseRowsPage,
): DatabasePayload {
  return {
    ...schema,
    rows: page.rows,
    values: page.values,
    rowsPagination: {
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    },
  }
}

export function appendDatabaseRowPage(
  payload: DatabasePayload,
  page: DatabaseRowsPage,
): DatabasePayload {
  return {
    ...payload,
    rows: mergeRowsByPosition(payload.rows, page.rows),
    values: mergeValuesByKey(payload.values, page.values),
    rowsPagination: {
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    },
  }
}

function mergeRowsByPosition(
  currentRows: DatabaseRow[],
  nextRows: DatabaseRow[],
) {
  const rowsById = new Map(currentRows.map((row) => [row.id, row]))

  for (const row of nextRows) {
    rowsById.set(row.id, row)
  }

  return Array.from(rowsById.values()).sort(
    (left, right) => left.position - right.position,
  )
}

function mergeValuesByKey(
  currentValues: WorkspacePropertyValue[],
  nextValues: WorkspacePropertyValue[],
) {
  const valuesByKey = new Map(
    currentValues.map((value) => [
      `${value.workspaceId}:${value.propertyId}`,
      value,
    ]),
  )

  for (const value of nextValues) {
    valuesByKey.set(`${value.workspaceId}:${value.propertyId}`, value)
  }

  return Array.from(valuesByKey.values())
}