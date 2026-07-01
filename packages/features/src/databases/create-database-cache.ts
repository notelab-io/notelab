import type { DatabasePayload } from "./queries"
import { readDatabaseParentItemId } from "../workspaces/item-relationships"
import { applyNavDelta, type NavDelta } from "../workspaces/nav-delta"
import type {
  Workspace,
  WorkspaceDatabase,
  WorkspaceItemPlacement,
} from "../workspaces/queries"

function toWorkspaceDatabase(payload: DatabasePayload): WorkspaceDatabase {
  return {
    ...payload.database,
    views: payload.views,
  }
}

function getPrimaryDatabasePlacement(
  payload: DatabasePayload,
): WorkspaceItemPlacement | null {
  const parentItemId = readDatabaseParentItemId(payload.database.config)

  if (!parentItemId) {
    return null
  }

  return {
    id: `legacy:primary:workspace:${parentItemId}:database:${payload.database.id}:`,
    itemId: payload.database.id,
    itemKind: "database",
    organizationId: payload.database.organizationId,
    parentId: parentItemId,
    parentKind: "workspace",
    placementKind: "primary",
    position: 0,
    sourceRowId: null,
  }
}

export function getCreatedDatabaseNavDelta(payload: DatabasePayload): NavDelta {
  const database = toWorkspaceDatabase(payload)
  const placement = getPrimaryDatabasePlacement(payload)

  return {
    upsertDatabases: [database],
    upsertPlacements: placement ? [placement] : [],
  }
}

export function applyCreatedDatabaseToWorkspaceNav(
  workspaces: Workspace[] | undefined,
  payload: DatabasePayload,
) {
  return applyNavDelta(workspaces, getCreatedDatabaseNavDelta(payload))
}
