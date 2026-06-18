import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "@notelab/features/auth"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

import { API_BASE_URL, apiFetch } from "@/lib/api"

export type WorkspaceCollaborationUser = {
  color: string
  email?: string
  id: string
  image?: string | null
  name: string
}

export type WorkspaceCollaborationState = {
  provider: WebsocketProvider | null
  status: "connecting" | "connected" | "disconnected" | "offline"
  user: WorkspaceCollaborationUser | null
  ydoc: Y.Doc | null
}

type UseWorkspaceCollaborationOptions = {
  enabled: boolean
  seedUpdate?: Uint8Array | null
  workspaceId?: string | null
  workspaceUpdatedAt?: string | null
}

const collaboratorColors = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#be123c",
]

const postgresNewerThresholdMs = 5_000

export function useWorkspaceCollaboration({
  enabled,
  seedUpdate,
  workspaceId,
  workspaceUpdatedAt,
}: UseWorkspaceCollaborationOptions): WorkspaceCollaborationState {
  const { data: session } = useSession()
  const user = useMemo(() => {
    const sessionUser = session?.user

    if (!sessionUser) {
      return null
    }

    return {
      color: getStableColor(sessionUser.id),
      email: sessionUser.email,
      id: sessionUser.id,
      image: sessionUser.image,
      name: sessionUser.name || sessionUser.email || "Collaborator",
    }
  }, [
    session?.user?.email,
    session?.user?.id,
    session?.user?.image,
    session?.user?.name,
  ])
  const seedUpdateRef = useRef<Uint8Array | null>(null)
  const workspaceUpdatedAtRef = useRef(workspaceUpdatedAt ?? null)
  const [state, setState] = useState<WorkspaceCollaborationState>({
    provider: null,
    status: "offline",
    user: null,
    ydoc: null,
  })

  useEffect(() => {
    seedUpdateRef.current = seedUpdate ?? null
  }, [seedUpdate])

  useEffect(() => {
    workspaceUpdatedAtRef.current = workspaceUpdatedAt ?? null
  }, [workspaceUpdatedAt])

  useEffect(() => {
    if (!state.provider || !user) {
      return
    }

    state.provider.awareness.setLocalStateField("user", user)
    setState((current) =>
      current.provider === state.provider ? { ...current, user } : current,
    )
  }, [state.provider, user])

  useEffect(() => {
    const seed = seedUpdateRef.current

    if (!enabled || !workspaceId || !seed || !user) {
      setState({
        provider: null,
        status: "offline",
        user: null,
        ydoc: null,
      })
      return
    }

    let disposed = false
    let didExposeProvider = false
    const ydoc = new Y.Doc()
    const provider = new WebsocketProvider(
      getCollaborationServerUrl(workspaceId),
      "collaboration",
      ydoc,
      { connect: false, disableBc: false },
    )

    provider.awareness.setLocalStateField("user", user)
    setState({
      provider: null,
      status: "connecting",
      user,
      ydoc: null,
    })

    const exposeProvider = () => {
      if (disposed || didExposeProvider) {
        return
      }

      didExposeProvider = true
      setState({
        provider,
        status: provider.wsconnected ? "connected" : "connecting",
        user,
        ydoc,
      })
    }

    const handleStatus = ({
      status,
    }: {
      status: WorkspaceCollaborationState["status"]
    }) => {
      if (disposed) {
        return
      }

      setState((current) => ({
        ...current,
        status,
      }))
    }
    const handleSync = (synced: boolean) => {
      if (synced) {
        exposeProvider()
      }
    }
    const connect = async () => {
      try {
        const status = await fetchCollaborationStatus(workspaceId)

        if (disposed) {
          return
        }

        if (!status.hasDocument) {
          await initializeRoom(workspaceId, seed)
        } else {
          const workspaceUpdatedAtMs = Date.parse(
            workspaceUpdatedAtRef.current ?? "",
          )
          const doUpdatedAtMs = status.doUpdatedAt ?? 0

          if (
            Number.isFinite(workspaceUpdatedAtMs) &&
            workspaceUpdatedAtMs - doUpdatedAtMs > postgresNewerThresholdMs
          ) {
            console.warn(
              "Postgres workspace content is newer than collaboration room; reinitializing",
              { doUpdatedAtMs, workspaceId, workspaceUpdatedAtMs },
            )
            await reinitializeRoom(workspaceId, seed)
          }
        }

        if (disposed) {
          return
        }

        provider.on("status", handleStatus)
        provider.on("sync", handleSync)
        provider.connect()

        if (provider.synced) {
          exposeProvider()
        }
      } catch {
        if (disposed) {
          return
        }

        provider.destroy()
        ydoc.destroy()
        setState({
          provider: null,
          status: "offline",
          user: null,
          ydoc: null,
        })
      }
    }

    void connect()

    return () => {
      disposed = true
      provider.off("status", handleStatus)
      provider.off("sync", handleSync)
      provider.destroy()
      ydoc.destroy()
    }
  }, [enabled, Boolean(seedUpdate), user?.id, workspaceId])

  return state
}

async function fetchCollaborationStatus(workspaceId: string) {
  return apiFetch<{
    doUpdatedAt: number | null
    hasDocument: boolean
    workspaceUpdatedAt: string
  }>(`/workspaces/${encodeURIComponent(workspaceId)}/collaboration/status`)
}

async function initializeRoom(workspaceId: string, update: Uint8Array) {
  await apiFetch<{ applied: boolean; initialized: boolean }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/collaboration/initialize`,
    {
      body: JSON.stringify({ update: encodeBase64(update) }),
      method: "POST",
    },
  )
}

async function reinitializeRoom(workspaceId: string, update: Uint8Array) {
  await apiFetch<{ applied: boolean; reinitialized: boolean }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/collaboration/reinitialize`,
    {
      body: JSON.stringify({ update: encodeBase64(update) }),
      method: "POST",
    },
  )
}

function getCollaborationServerUrl(workspaceId: string) {
  const baseUrl = getCollaborationBaseUrl()
  const url = new URL(baseUrl, window.location.origin)

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `/workspaces/${encodeURIComponent(workspaceId)}`
  url.search = ""

  return url.toString().replace(/\/$/, "")
}

function getCollaborationBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL
  }

  if (import.meta.env.DEV && isLocalDevelopmentHost(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:3000`
  }

  return window.location.origin
}

function isLocalDevelopmentHost(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  )
}

function encodeBase64(update: Uint8Array) {
  let binary = ""
  const chunkSize = 0x8000

  for (let index = 0; index < update.length; index += chunkSize) {
    binary += String.fromCharCode(...update.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function getStableColor(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return collaboratorColors[Math.abs(hash) % collaboratorColors.length]
}