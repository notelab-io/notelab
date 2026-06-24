import Dexie, { type Table } from "dexie"

import type { DatabasePayload } from "./queries"
import type { OutboxEntry } from "./sync-types"

type StoredDatabasePayload = {
  databaseId: string
  payload: DatabasePayload
  updatedAt: number
}

type SyncMetaRecord = {
  databaseId: string
  lastSyncedAt: number
  serverVersion: number
}

class NotelabDatabaseDexie extends Dexie {
  databasePayloads!: Table<StoredDatabasePayload, string>
  outbox!: Table<OutboxEntry, string>
  syncMeta!: Table<SyncMetaRecord, string>

  constructor() {
    super("notelab-databases")

    this.version(1).stores({
      databasePayloads: "databaseId, updatedAt",
      outbox:
        "id, databaseId, status, createdAt, clientMutationId, [databaseId+status], [databaseId+clientMutationId]",
      syncMeta: "databaseId",
    })
  }
}

let localDb: NotelabDatabaseDexie | null = null

export function getLocalDatabaseDb() {
  if (typeof indexedDB === "undefined") {
    return null
  }

  if (!localDb) {
    localDb = new NotelabDatabaseDexie()
  }

  return localDb
}