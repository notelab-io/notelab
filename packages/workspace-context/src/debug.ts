export type WorkspaceContextLogMeta = {
  primaryId?: string | null
  attachmentIds?: string[]
  charCount: number
  buildMs: number
  trimmedAttachmentIds?: string[]
}

function shouldLogWorkspaceContext() {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return true
  }

  if (typeof localStorage === "undefined") {
    return false
  }

  return localStorage.getItem("notelabDebugAiContext") === "1"
}

export function logWorkspaceContext(
  markdown: string,
  meta: WorkspaceContextLogMeta,
) {
  if (!shouldLogWorkspaceContext()) {
    return
  }

  console.group("[Notelab AI Context]")
  console.log("meta:", meta)
  console.log(`markdown (${meta.charCount} chars):\n`, markdown)
  console.groupEnd()
}

export function logWorkspaceContextRebuild(meta: {
  attachmentCount: number
  charCount: number
  buildMs: number
}) {
  if (!shouldLogWorkspaceContext()) {
    return
  }

  console.log(
    `[Notelab AI Context] rebuilt (${meta.attachmentCount} attachments, ${meta.charCount} chars, ${meta.buildMs}ms)`,
  )
}

export function logWorkspaceContextSent(meta: {
  charCount: number
  attachmentCount: number
}) {
  if (!shouldLogWorkspaceContext()) {
    return
  }

  console.log("[Notelab AI Context] sent with message", meta)
}

export function warnWorkspaceContextTrimmed(droppedAttachmentIds: string[]) {
  if (!shouldLogWorkspaceContext()) {
    return
  }

  console.warn("[Notelab AI Context] trimmed attachments", {
    dropped: droppedAttachmentIds,
  })
}