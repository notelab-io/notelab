import * as decoding from "lib0/decoding"
import * as encoding from "lib0/encoding"

export const workspaceRealtimeMessageType = 4

export type WorkspaceChangedEvent = {
  type: "workspace.changed"
  actorId: string
  changed: Array<"metadata" | "name" | "content">
  committedAt: string
  mutationId: string
  organizationId: string
  workspaceId: string
}

export type WorkspaceCommentsChangedKind =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "reaction.created"
  | "reaction.deleted"
  | "thread.resolved"
  | "thread.unresolved"

export type WorkspaceCommentsChangedEvent = {
  type: "comments.changed"
  actorId: string
  changed: WorkspaceCommentsChangedKind[]
  committedAt: string
  mutationId: string
  organizationId: string
  threadId: string
  workspaceId: string
}

export type WorkspaceRealtimeEvent =
  | WorkspaceChangedEvent
  | WorkspaceCommentsChangedEvent

export type WorkspaceRealtimeMultiplexProvider = {
  messageHandlers: Array<
    | ((
        encoder: unknown,
        decoder: decoding.Decoder,
        provider: unknown,
        emitSynced: boolean,
        messageType: number,
      ) => void)
    | undefined
  >
  off: (
    event: "status",
    handler: (payload: [
      { status: "connected" | "disconnected" | "connecting" },
    ]) => void,
  ) => void
  on: (
    event: "status",
    handler: (payload: [
      { status: "connected" | "disconnected" | "connecting" },
    ]) => void,
  ) => void
}

export function getWorkspaceRealtimeUrl(
  workspaceId: string,
  realtimeBaseUrl: string | undefined,
  currentOrigin: string,
) {
  const baseUrl = realtimeBaseUrl || currentOrigin
  const url = new URL(baseUrl, currentOrigin)

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `/workspaces/${encodeURIComponent(workspaceId)}/realtime`
  url.search = ""

  return url.toString()
}

export function encodeWorkspaceRealtimeFrame(event: WorkspaceRealtimeEvent) {
  const encoder = encoding.createEncoder()

  encoding.writeVarUint(encoder, workspaceRealtimeMessageType)
  encoding.writeVarUint8Array(
    encoder,
    new TextEncoder().encode(JSON.stringify(event)),
  )

  return encoding.toUint8Array(encoder)
}

export async function normalizeWorkspaceRealtimeMessageData(
  data: unknown,
): Promise<ArrayBuffer | Uint8Array | string | null> {
  if (typeof data === "string") {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return data
  }

  if (data instanceof Uint8Array) {
    return data
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.arrayBuffer()
  }

  return null
}

export function parseWorkspaceRealtimeFrame(
  data: ArrayBuffer | Uint8Array,
): WorkspaceRealtimeEvent | null {
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    const decoder = decoding.createDecoder(bytes)
    const messageType = decoding.readVarUint(decoder)

    if (messageType !== workspaceRealtimeMessageType) {
      return null
    }

    const payload = decoding.readVarUint8Array(decoder)

    return parseWorkspaceRealtimeEvent(new TextDecoder().decode(payload))
  } catch {
    return null
  }
}

export function parseWorkspaceRealtimeEvent(
  data: unknown,
): WorkspaceRealtimeEvent | null {
  if (typeof data !== "string") {
    return null
  }

  try {
    const parsed = JSON.parse(data) as unknown

    return parsed && typeof parsed === "object"
      ? (parsed as WorkspaceRealtimeEvent)
      : null
  } catch {
    return null
  }
}