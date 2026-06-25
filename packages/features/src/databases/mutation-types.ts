export type DatabaseChangedArea =
  | "database"
  | "views"
  | "properties"
  | "rows"
  | "values"

export type DatabaseDelta = {
  database?: Record<string, unknown>
  properties?: Array<Record<string, unknown>>
  removedPropertyIds?: string[]
  removedViewIds?: string[]
  rows?: Array<Record<string, unknown>>
  values?: Array<{
    createdAt?: string
    id?: string
    propertyId: string
    updatedAt: string
    value: unknown
    workspaceId: string
  }>
  views?: Array<Record<string, unknown>>
}

export type DatabaseMutationResponse = {
  changed: DatabaseChangedArea[]
  committedAt: string
  databaseId: string
  delta: DatabaseDelta
  mutationId: string
}

export function isDatabaseMutationResponse(
  value: unknown,
): value is DatabaseMutationResponse {
  if (!value || typeof value !== "object") {
    return false
  }

  const response = value as DatabaseMutationResponse

  return (
    typeof response.mutationId === "string" &&
    typeof response.databaseId === "string" &&
    response.delta !== undefined &&
    Array.isArray(response.changed)
  )
}