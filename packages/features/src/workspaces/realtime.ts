import * as decoding from "lib0/decoding"
import { useEffect, useRef, useState } from "react"

import { useNotelabFeatures } from "../context"
import { createWorkspaceRealtimeSubscription } from "./realtime-subscription"
import {
  getWorkspaceRealtimeUrl,
  normalizeWorkspaceRealtimeMessageData,
  parseWorkspaceRealtimeEvent,
  parseWorkspaceRealtimeFrame,
  workspaceRealtimeMessageType,
  type WorkspaceRealtimeMultiplexProvider,
} from "./realtime-utils"

type WorkspaceRealtimeOptions = {
  enabled?: boolean
  multiplexOnly?: boolean
  multiplexProvider?: WorkspaceRealtimeMultiplexProvider | null
  organizationId?: string | null
}

export function useWorkspaceRealtime(
  workspaceId: string | null | undefined,
  {
    enabled = true,
    multiplexOnly = false,
    multiplexProvider = null,
    organizationId = null,
  }: WorkspaceRealtimeOptions = {},
) {
  const { queryClient, realtimeBaseUrl } = useNotelabFeatures()
  const [status, setStatus] = useState<
    "connected" | "connecting" | "disconnected" | "offline"
  >("offline")
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)

  useEffect(() => {
    if (!enabled || !workspaceId || typeof WebSocket === "undefined") {
      setStatus("offline")
      return
    }

    const subscription = createWorkspaceRealtimeSubscription({
      organizationId,
      queryClient,
      workspaceId,
    })

    if (multiplexOnly && !multiplexProvider) {
      setStatus("offline")
      return
    }

    if (multiplexProvider) {
      let disposed = false

      const handleStatus = ([payload]: [
        { status: "connected" | "disconnected" | "connecting" },
      ]) => {
        if (disposed) {
          return
        }

        setStatus(payload.status)

        if (payload.status === "connected" && reconnectAttemptRef.current > 0) {
          subscription.scheduleReconnectRefetch()
          reconnectAttemptRef.current = 0
        }

        if (payload.status === "disconnected") {
          reconnectAttemptRef.current += 1
        }
      }

      const previousHandler =
        multiplexProvider.messageHandlers[workspaceRealtimeMessageType]

      multiplexProvider.messageHandlers[workspaceRealtimeMessageType] = (
        _encoder,
        decoder,
        _provider,
        _emitSynced,
        _messageType,
      ) => {
        try {
          const payload = decoding.readVarUint8Array(decoder)
          const message = parseWorkspaceRealtimeEvent(
            new TextDecoder().decode(payload),
          )

          if (message) {
            subscription.handleEvent(message)
          }
        } catch {
          return
        }
      }

      multiplexProvider.on("status", handleStatus)

      return () => {
        disposed = true
        setStatus("offline")
        subscription.dispose()

        if (previousHandler) {
          multiplexProvider.messageHandlers[workspaceRealtimeMessageType] =
            previousHandler
        } else {
          delete multiplexProvider.messageHandlers[workspaceRealtimeMessageType]
        }

        multiplexProvider.off("status", handleStatus)
      }
    }

    let disposed = false

    const connect = () => {
      if (disposed) {
        return
      }

      setStatus("connecting")

      const socket = new WebSocket(
        getWorkspaceRealtimeUrl(
          workspaceId,
          realtimeBaseUrl,
          window.location.origin,
        ),
      )

      socket.binaryType = "arraybuffer"
      socketRef.current = socket

      socket.addEventListener("open", () => {
        if (disposed) {
          return
        }

        setStatus("connected")

        if (reconnectAttemptRef.current > 0) {
          subscription.scheduleReconnectRefetch()
        }

        reconnectAttemptRef.current = 0
      })

      socket.addEventListener("message", (event) => {
        void handleRealtimeSocketMessage(event.data, subscription)
      })

      socket.addEventListener("close", () => {
        if (disposed) {
          return
        }

        setStatus("disconnected")
        socketRef.current = null
        reconnectAttemptRef.current += 1
        reconnectTimeoutRef.current = window.setTimeout(
          connect,
          Math.min(10_000, 500 * 2 ** reconnectAttemptRef.current),
        )
      })

      socket.addEventListener("error", () => {
        socket.close()
      })
    }

    connect()

    return () => {
      disposed = true
      setStatus("offline")
      subscription.dispose()

      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }

      socketRef.current?.close()
      socketRef.current = null
    }
  }, [
    enabled,
    multiplexOnly,
    multiplexProvider,
    organizationId,
    queryClient,
    realtimeBaseUrl,
    workspaceId,
  ])

  return { status }
}

async function handleRealtimeSocketMessage(
  data: unknown,
  subscription: ReturnType<typeof createWorkspaceRealtimeSubscription>,
) {
  const normalized = await normalizeWorkspaceRealtimeMessageData(data)

  if (!normalized) {
    return
  }

  const message =
    typeof normalized === "string"
      ? parseWorkspaceRealtimeEvent(normalized)
      : parseWorkspaceRealtimeFrame(normalized)

  if (message) {
    subscription.handleEvent(message)
  }
}