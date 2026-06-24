import type { ApiFetcher } from "../context"
import type { DatabasePayload } from "./queries"
import {
  createInitialPaginatedPayload,
  DEFAULT_DATABASE_ROWS_PAGE_SIZE,
  type DatabaseRowsPage,
} from "./row-pagination"

export async function fetchPaginatedDatabasePayload(
  apiFetch: ApiFetcher,
  databaseId: string,
) {
  const schema = await apiFetch<DatabasePayload>(
    `/databases/${databaseId}?schemaOnly=1`,
    { method: "GET" },
  )

  if (!schema) {
    return null
  }

  const page = await apiFetch<DatabaseRowsPage>(
    `/databases/${databaseId}/rows?limit=${DEFAULT_DATABASE_ROWS_PAGE_SIZE}`,
    { method: "GET" },
  )

  return createInitialPaginatedPayload(schema, page)
}