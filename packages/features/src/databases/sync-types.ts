import type { DatabaseChangedArea } from "./realtime-utils"

export type DatabaseDelta = {
  database?: Record<string, unknown>
  properties?: Array<Record<string, unknown>>
  removedPropertyIds?: string[]
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
  clientMutationId?: string
  committedAt: string
  databaseId: string
  delta: DatabaseDelta
  mutationId: string
  version: number
}

export type DatabaseSyncResponse = {
  databaseId: string
  mutations: Array<{
    actorId: string
    changed: DatabaseChangedArea[]
    clientMutationId: string | null
    committedAt: string
    delta: DatabaseDelta
    id: string
    version: number
  }>
  version: number
}

export type DatabaseBatchMutationResponse = {
  databaseId: string
  results: Array<DatabaseMutationResponse & { clientMutationId: string }>
  version: number
}

export type OutboxMutationType =
  | "addProperty"
  | "addRow"
  | "addView"
  | "deleteProperty"
  | "duplicateProperty"
  | "moveRow"
  | "reorderProperties"
  | "reorderRows"
  | "updateDatabase"
  | "updateProperty"
  | "updatePropertyValue"
  | "updateView"

export type OutboxEntry = {
  clientMutationId: string
  createdAt: number
  databaseId: string
  attempts: number
  id: string
  lastError?: string | null
  payload: Record<string, unknown>
  status: "committing" | "committed" | "failed" | "pending"
  type: OutboxMutationType
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
    typeof response.version === "number" &&
    typeof response.databaseId === "string" &&
    response.delta !== undefined &&
    Array.isArray(response.changed)
  )
}