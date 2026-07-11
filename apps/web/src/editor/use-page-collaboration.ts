import { useEffect, useState } from "react"
import {
  HocuspocusProvider,
  type StatesArray,
  WebSocketStatus,
} from "@hocuspocus/provider"
import type { SessionUser } from "@notelab/features/auth"
import { apiFetch } from "@/lib/api"

type CollaborationTicket = {
  documentName: string
  expiresAt: string
  token: string
  websocketUrl: string
}

export type CollaborationUser = {
  avatar?: string | null
  clientId: number
  color: string
  id: string
  name: string
}

export function usePageCollaboration({
  enabled,
  pageId,
  user,
}: {
  enabled: boolean
  pageId: string
  user: SessionUser | null | undefined
}) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null)
  const [status, setStatus] = useState<WebSocketStatus>(
    WebSocketStatus.Disconnected,
  )
  const [synced, setSynced] = useState(false)
  const [users, setUsers] = useState<CollaborationUser[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !user) {
      setProvider(null)
      setSynced(false)
      setUsers([])
      setError(null)
      return
    }

    let disposed = false
    let activeProvider: HocuspocusProvider | null = null

    void apiFetch<CollaborationTicket>(
      `/pages/${encodeURIComponent(pageId)}/collaboration-ticket`,
      { method: "POST" },
    )
      .then((ticket) => {
        if (disposed) return

        let currentTicket = ticket

        activeProvider = new HocuspocusProvider({
          name: ticket.documentName,
          token: async () => {
            if (
              new Date(currentTicket.expiresAt).getTime() >
              Date.now() + 30_000
            ) {
              return currentTicket.token
            }

            currentTicket = await apiFetch<CollaborationTicket>(
              `/pages/${encodeURIComponent(pageId)}/collaboration-ticket`,
              { method: "POST" },
            )
            return currentTicket.token
          },
          url: ticket.websocketUrl,
          onAuthenticationFailed: ({ reason }) => {
            if (!disposed) setError(reason || "Collaboration access was denied.")
          },
          onStatus: ({ status: nextStatus }) => {
            if (!disposed) setStatus(nextStatus)
          },
          onSynced: ({ state }) => {
            if (!disposed && state) setSynced(true)
          },
          onAwarenessUpdate: ({ states }) => {
            if (!disposed) setUsers(readCollaborationUsers(states))
          },
        })
        setProvider(activeProvider)
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not start collaboration.",
          )
        }
      })

    return () => {
      disposed = true
      activeProvider?.destroy()
      setProvider(null)
      setSynced(false)
      setUsers([])
    }
  }, [
    enabled,
    pageId,
    user?.email,
    user?.id,
    user?.image,
    user?.name,
  ])

  return {
    error,
    provider,
    status,
    synced,
    user: user
      ? {
          avatar: user.image,
          color: collaborationColor(user.id),
          id: user.id,
          name: user.name || user.email,
        }
      : null,
    users,
  }
}

function readCollaborationUsers(states: StatesArray) {
  const users = new Map<string, CollaborationUser>()

  for (const state of states) {
    const user = state.user as Partial<CollaborationUser> | undefined

    if (
      !user ||
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.color !== "string"
    ) {
      continue
    }

    users.set(`${state.clientId}:${user.id}`, {
      avatar: typeof user.avatar === "string" ? user.avatar : null,
      clientId: state.clientId,
      color: user.color,
      id: user.id,
      name: user.name,
    })
  }

  return [...users.values()]
}

function collaborationColor(id: string) {
  const colors = [
    "#2563eb",
    "#059669",
    "#dc2626",
    "#7c3aed",
    "#c2410c",
    "#0f766e",
    "#be185d",
    "#4f46e5",
  ]
  let hash = 0

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }

  return colors[hash % colors.length]
}
