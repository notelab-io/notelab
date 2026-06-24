import { applyDatabaseDelta } from "./apply-delta"
import { getLocalDatabaseDb } from "./local-db"
import type { DatabasePayload } from "./queries"
import type { DatabaseDelta } from "./sync-types"

export async function readLocalDatabasePayload(databaseId: string) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return null
  }

  const record = await db.databasePayloads.get(databaseId)

  return record?.payload ?? null
}

export async function writeLocalDatabasePayload(
  databaseId: string,
  payload: DatabasePayload,
) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return payload
  }

  await db.databasePayloads.put({
    databaseId,
    payload,
    updatedAt: Date.now(),
  })
  await db.syncMeta.put({
    databaseId,
    lastSyncedAt: Date.now(),
    serverVersion: payload.database.version,
  })

  return payload
}

export async function applyLocalDatabaseDelta(
  databaseId: string,
  delta: DatabaseDelta,
  options?: { version?: number },
) {
  const current =
    (await readLocalDatabasePayload(databaseId)) ??
    ({
      database: {
        createdAt: new Date().toISOString(),
        id: databaseId,
        name: "",
        organizationId: "",
        pageId: "",
        updatedAt: new Date().toISOString(),
        version: options?.version ?? 0,
      },
      properties: [],
      rows: [],
      values: [],
      views: [],
    } satisfies DatabasePayload)

  const next = applyDatabaseDelta(current, delta)

  if (typeof options?.version === "number") {
    next.database.version = options.version
  }

  await writeLocalDatabasePayload(databaseId, next)

  return next
}

export async function getLocalDatabaseServerVersion(databaseId: string) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return 0
  }

  const meta = await db.syncMeta.get(databaseId)

  return meta?.serverVersion ?? 0
}

export async function setLocalDatabaseServerVersion(
  databaseId: string,
  serverVersion: number,
) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return
  }

  const existing = await db.syncMeta.get(databaseId)

  await db.syncMeta.put({
    databaseId,
    lastSyncedAt: Date.now(),
    serverVersion,
    ...(existing ? {} : {}),
  })
}