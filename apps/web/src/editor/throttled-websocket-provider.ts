import * as bc from "lib0/broadcastchannel"
import * as encoding from "lib0/encoding"
import * as awarenessProtocol from "y-protocols/awareness"
import * as syncProtocol from "y-protocols/sync"
import type { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

const messageSync = 0
const messageAwareness = 1

type ThrottleOptions = {
  awarenessMs?: number
  syncMs?: number
}

export function installOutboundMessageThrottling(
  provider: WebsocketProvider,
  { awarenessMs = 250, syncMs = 50 }: ThrottleOptions = {},
) {
  provider.doc.off("update", provider._updateHandler)
  provider.awareness.off("update", provider._awarenessUpdateHandler)

  let pendingSyncUpdate: Uint8Array | null = null
  let syncTimeout: number | null = null
  let pendingAwarenessClients: number[] | null = null
  let awarenessTimeout: number | null = null

  const flushSync = () => {
    if (!pendingSyncUpdate) {
      return
    }

    const update = pendingSyncUpdate

    pendingSyncUpdate = null
    syncTimeout = null

    const encoder = encoding.createEncoder()

    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    sendBuffer(provider, encoding.toUint8Array(encoder))
  }

  const flushAwareness = () => {
    if (!pendingAwarenessClients) {
      return
    }

    const clients = pendingAwarenessClients

    pendingAwarenessClients = null
    awarenessTimeout = null

    const encoder = encoding.createEncoder()

    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(provider.awareness, clients),
    )
    sendBuffer(provider, encoding.toUint8Array(encoder))
  }

  provider.doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === provider) {
      return
    }

    pendingSyncUpdate = pendingSyncUpdate
      ? Y.mergeUpdates([pendingSyncUpdate, update])
      : update

    if (syncTimeout === null) {
      syncTimeout = window.setTimeout(flushSync, syncMs)
    }
  })

  provider.awareness.on(
    "update",
    ({
      added,
      updated,
      removed,
    }: {
      added: number[]
      removed: number[]
      updated: number[]
    }) => {
      const changedClients = added.concat(updated).concat(removed)

      pendingAwarenessClients = [
        ...new Set([...(pendingAwarenessClients ?? []), ...changedClients]),
      ]

      if (removed.length > 0) {
        if (awarenessTimeout !== null) {
          window.clearTimeout(awarenessTimeout)
          awarenessTimeout = null
        }

        flushAwareness()
        return
      }

      if (awarenessTimeout === null) {
        awarenessTimeout = window.setTimeout(flushAwareness, awarenessMs)
      }
    },
  )

  return () => {
    if (syncTimeout !== null) {
      window.clearTimeout(syncTimeout)
    }

    if (awarenessTimeout !== null) {
      window.clearTimeout(awarenessTimeout)
    }

    flushSync()
    flushAwareness()
  }
}

function sendBuffer(provider: WebsocketProvider, buffer: Uint8Array) {
  const socket = provider.ws

  if (provider.wsconnected && socket?.readyState === WebSocket.OPEN) {
    socket.send(buffer)
  }

  if (provider.bcconnected) {
    bc.publish(provider.bcChannel, buffer, provider)
  }
}