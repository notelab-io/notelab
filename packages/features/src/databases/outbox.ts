import { getLocalDatabaseDb } from "./local-db"
import type { OutboxEntry, OutboxMutationType } from "./sync-types"

export async function enqueueDatabaseMutation(input: {
  clientMutationId: string
  databaseId: string
  payload: Record<string, unknown>
  type: OutboxMutationType
}) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return null
  }

  const existing = await db.outbox
    .where("[databaseId+clientMutationId]")
    .equals([input.databaseId, input.clientMutationId] as [string, string])
    .first()

  if (existing && existing.status !== "committed") {
    return existing
  }

  if (input.type === "updatePropertyValue") {
    const rowId = input.payload.rowId
    const propertyId = input.payload.propertyId

    if (typeof rowId === "string" && typeof propertyId === "string") {
      const pending = await db.outbox
        .where("[databaseId+status]")
        .equals([input.databaseId, "pending"] as [string, string])
        .filter(
          (entry) =>
            entry.type === "updatePropertyValue" &&
            entry.payload.rowId === rowId &&
            entry.payload.propertyId === propertyId,
        )
        .toArray()

      if (pending.length > 0) {
        const [latest, ...duplicates] = pending.sort(
          (left, right) => right.createdAt - left.createdAt,
        )

        await db.outbox.update(latest.id, {
          clientMutationId: input.clientMutationId,
          createdAt: Date.now(),
          payload: input.payload,
        })
        await db.outbox.bulkDelete(duplicates.map((entry) => entry.id))

        return {
          ...latest,
          clientMutationId: input.clientMutationId,
          createdAt: Date.now(),
          payload: input.payload,
        } satisfies OutboxEntry
      }
    }
  }

  const entry: OutboxEntry = {
    attempts: 0,
    clientMutationId: input.clientMutationId,
    createdAt: Date.now(),
    databaseId: input.databaseId,
    id: crypto.randomUUID(),
    payload: input.payload,
    status: "pending",
    type: input.type,
  }

  await db.outbox.put(entry)

  return entry
}

export async function listPendingDatabaseMutations(databaseId: string) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return []
  }

  return db.outbox
    .where("[databaseId+status]")
    .equals([databaseId, "pending"] as [string, string])
    .sortBy("createdAt")
}

export async function markDatabaseMutationsCommitting(ids: string[]) {
  const db = getLocalDatabaseDb()

  if (!db || ids.length === 0) {
    return
  }

  await db.transaction("rw", db.outbox, async () => {
    for (const id of ids) {
      await db.outbox.update(id, { status: "committing" })
    }
  })
}

export async function markDatabaseMutationsCommitted(ids: string[]) {
  const db = getLocalDatabaseDb()

  if (!db || ids.length === 0) {
    return
  }

  await db.outbox.bulkDelete(ids)
}

export async function markDatabaseMutationFailed(
  id: string,
  error: string,
) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return
  }

  const entry = await db.outbox.get(id)

  if (!entry) {
    return
  }

  await db.outbox.update(id, {
    attempts: entry.attempts + 1,
    lastError: error,
    status: entry.attempts >= 4 ? "failed" : "pending",
  })
}

export async function countPendingDatabaseMutations(databaseId: string) {
  const db = getLocalDatabaseDb()

  if (!db) {
    return 0
  }

  return db.outbox
    .where("[databaseId+status]")
    .equals([databaseId, "pending"] as [string, string])
    .count()
}