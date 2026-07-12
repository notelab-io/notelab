import type {
  DatabasePayload,
  DatabaseRow,
  PagePropertyValue,
} from "./queries"

export type AddRowCacheInput = {
  pageId?: string
  parentRowId?: string | null
  position?: number
  sourceDatabaseId?: string
  sourcePropertyMode?: "duplicate" | "match"
  title?: string
  values?: Array<{
    propertyId: string
    value: unknown
  }>
}

export type AddRowResponse = {
  createdAt: string
  databaseId: string
  isFavorite?: boolean
  pageId: string
  parentRowId?: string | null
  position: number
  rowId: string
  title: string
  updatedAt: string
  values?: PagePropertyValue[]
}

export type OptimisticAddRowResult = {
  pageId: string
  payload: DatabasePayload
  rowId: string
}

export function isAddRowResponse(response: unknown): response is AddRowResponse {
  if (!response || typeof response !== "object") {
    return false
  }

  const value = response as AddRowResponse

  return (
    typeof value.databaseId === "string" &&
    typeof value.rowId === "string" &&
    typeof value.pageId === "string" &&
    typeof value.position === "number" &&
    typeof value.title === "string"
  )
}

function getAddRowPosition(payload: DatabasePayload, position?: number) {
  return position === undefined
    ? payload.rows.length
    : Math.min(position, payload.rows.length)
}

export function applyOptimisticAddedDatabaseRow(
  payload: DatabasePayload,
  input: AddRowCacheInput,
): OptimisticAddRowResult {
  const now = new Date().toISOString()
  const rowId = `optimistic-row-${crypto.randomUUID()}`
  const pageId = input.pageId ?? `optimistic-page-${crypto.randomUUID()}`
  const position = getAddRowPosition(payload, input.position)
  const title = input.title ?? "Untitled"
  const optimisticRow: DatabaseRow = {
    createdAt: now,
    databaseId: payload.database.id,
    id: rowId,
    lastEditedById: null,
    page: {
      id: pageId,
      name: title,
    },
    pageId,
    parentRowId: input.parentRowId ?? null,
    position,
    updatedAt: now,
  }
  const rows = payload.rows
    .map((row) =>
      row.position >= position
        ? { ...row, position: row.position + 1, updatedAt: now }
        : row,
    )
    .concat(optimisticRow)
    .sort((left, right) => left.position - right.position)
  const values = [...payload.values]

  for (const inputValue of input.values ?? []) {
    const existingIndex = values.findIndex(
      (value) =>
        value.pageId === pageId && value.propertyId === inputValue.propertyId,
    )
    const optimisticValue: PagePropertyValue = {
      createdAt: existingIndex >= 0 ? values[existingIndex]!.createdAt : now,
      id:
        existingIndex >= 0
          ? values[existingIndex]!.id
          : `optimistic-property-value-${crypto.randomUUID()}`,
      pageId,
      propertyId: inputValue.propertyId,
      updatedAt: now,
      value: inputValue.value,
    }

    if (existingIndex >= 0) {
      values[existingIndex] = optimisticValue
    } else {
      values.push(optimisticValue)
    }
  }

  return {
    pageId,
    rowId,
    payload: {
      ...payload,
      rowCount:
        payload.rowCount === undefined ? undefined : payload.rowCount + 1,
      rows,
      values,
    },
  }
}

export function applyConfirmedAddedDatabaseRow(
  payload: DatabasePayload,
  optimistic: { pageId: string; rowId: string } | null,
  response: AddRowResponse,
): DatabasePayload {
  const rows = [...payload.rows]
  const optimisticIndex = optimistic
    ? rows.findIndex((row) => row.id === optimistic.rowId)
    : -1
  const existingIndex = rows.findIndex((row) => row.id === response.rowId)
  const confirmedRow: DatabaseRow = {
    createdAt: response.createdAt,
    databaseId: response.databaseId,
    id: response.rowId,
    lastEditedById: null,
    page: {
      id: response.pageId,
      name: response.title,
    },
    pageId: response.pageId,
    parentRowId: response.parentRowId ?? null,
    position: response.position,
    updatedAt: response.updatedAt,
  }

  if (optimisticIndex >= 0) {
    rows[optimisticIndex] = {
      ...rows[optimisticIndex],
      ...confirmedRow,
      page: {
        ...rows[optimisticIndex]?.page,
        ...confirmedRow.page,
      },
    }
  } else if (existingIndex >= 0) {
    rows[existingIndex] = {
      ...rows[existingIndex],
      ...confirmedRow,
      page: {
        ...rows[existingIndex]?.page,
        ...confirmedRow.page,
      },
    }
  } else {
    const shiftedRows = rows.map((row) =>
      row.position >= response.position
        ? { ...row, position: row.position + 1 }
        : row,
    )
    rows.splice(0, rows.length, ...shiftedRows, confirmedRow)
  }

  const values = payload.values.map((value) =>
    optimistic && value.pageId === optimistic.pageId
      ? { ...value, pageId: response.pageId }
      : value,
  )

  for (const value of response.values ?? []) {
    const index = values.findIndex(
      (current) =>
        current.pageId === value.pageId &&
        current.propertyId === value.propertyId,
    )

    if (index >= 0) {
      values[index] = { ...values[index], ...value }
    } else {
      values.push(value)
    }
  }

  return {
    ...payload,
    rows: rows.sort((left, right) => left.position - right.position),
    values,
  }
}
