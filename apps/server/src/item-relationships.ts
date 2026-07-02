export type NavItemKind = "page" | "database"

export type ItemRef = {
  id: string
  kind: NavItemKind
}

export type PageItemMetadata = {
  parentItemId?: string | null
  parentItemKind?: NavItemKind | null
  linkedItems?: ItemRef[]
  [key: string]: unknown
}

export function readMetadataRecord(metadata: unknown): PageItemMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {}
  }

  return metadata as PageItemMetadata
}

export function readParentItemId(metadata: unknown) {
  const record = readMetadataRecord(metadata)
  const parentItemId = record.parentItemId

  return typeof parentItemId === "string" && parentItemId.length > 0
    ? parentItemId
    : null
}

export function readParentItemKind(metadata: unknown): NavItemKind | null {
  const record = readMetadataRecord(metadata)
  const kind = record.parentItemKind

  return kind === "page" || kind === "database" ? kind : null
}

export function readLinkedItems(metadata: unknown): ItemRef[] {
  const record = readMetadataRecord(metadata)
  const linkedItems = record.linkedItems

  if (!Array.isArray(linkedItems)) {
    return []
  }

  const seen = new Set<string>()

  return linkedItems.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return []
    }

    const id = (item as ItemRef).id
    const kind = (item as ItemRef).kind

    if (
      typeof id !== "string" ||
      id.length === 0 ||
      (kind !== "page" && kind !== "database")
    ) {
      return []
    }

    const key = `${kind}:${id}`

    if (seen.has(key)) {
      return []
    }

    seen.add(key)

    return [{ id, kind }]
  })
}

export function itemRefKey(ref: ItemRef) {
  return `${ref.kind}:${ref.id}`
}

export function wouldCreateParentCycle({
  childId,
  parentId,
  getParentItemId,
}: {
  childId: string
  parentId: string
  getParentItemId: (pageId: string) => string | null
}) {
  if (childId === parentId) {
    return true
  }

  const visited = new Set<string>()
  let current: string | null = parentId

  while (current) {
    if (current === childId || visited.has(current)) {
      return true
    }

    visited.add(current)
    current = getParentItemId(current)
  }

  return false
}

export type EmbedItemResult =
  | {
      action: "setParent"
      childMetadata: PageItemMetadata
      hostMetadata: PageItemMetadata
    }
  | {
      action: "addLink"
      childMetadata: PageItemMetadata
      hostMetadata: PageItemMetadata
    }

export function resolveEmbedItem({
  childId,
  childMetadata,
  hostMetadata,
  hostId,
  kind,
}: {
  childId: string
  childMetadata: unknown
  hostId: string
  hostMetadata: unknown
  kind: NavItemKind
}): EmbedItemResult {
  const childRecord = { ...readMetadataRecord(childMetadata) }
  const hostRecord = { ...readMetadataRecord(hostMetadata) }
  const existingParentId = readParentItemId(childRecord)
  const ref: ItemRef = { id: childId, kind }

  if (!existingParentId) {
    childRecord.parentItemId = hostId
    childRecord.parentItemKind = "page"

    return {
      action: "setParent",
      childMetadata: childRecord,
      hostMetadata: hostRecord,
    }
  }

  if (existingParentId === hostId) {
    return {
      action: "setParent",
      childMetadata: childRecord,
      hostMetadata: hostRecord,
    }
  }

  return {
    action: "addLink",
    childMetadata: childRecord,
    hostMetadata: addLinkedItem(hostRecord, ref),
  }
}

export function addLinkedItem(
  metadata: PageItemMetadata,
  ref: ItemRef,
): PageItemMetadata {
  const linkedItems = readLinkedItems(metadata)
  const key = itemRefKey(ref)

  if (linkedItems.some((item) => itemRefKey(item) === key)) {
    return metadata
  }

  return {
    ...metadata,
    linkedItems: [...linkedItems, ref],
  }
}

export function removeLinkedItem(
  metadata: PageItemMetadata,
  ref: ItemRef,
): PageItemMetadata {
  const key = itemRefKey(ref)
  const linkedItems = readLinkedItems(metadata).filter(
    (item) => itemRefKey(item) !== key,
  )

  return {
    ...metadata,
    linkedItems,
  }
}

export function clearParentItem(
  metadata: PageItemMetadata,
): PageItemMetadata {
  return {
    ...metadata,
    parentItemId: null,
    parentItemKind: null,
  }
}

export function readDatabaseParentItemId(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  const parentItemId = (config as { parentItemId?: unknown }).parentItemId

  return typeof parentItemId === "string" && parentItemId.length > 0
    ? parentItemId
    : null
}

export function withDatabaseParentItemId(
  config: unknown,
  parentItemId: string,
): Record<string, unknown> {
  const record =
    config && typeof config === "object" && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {}

  record.parentItemId = parentItemId
  record.parentItemKind = "page"

  return record
}