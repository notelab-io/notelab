import { useCallback, useEffect, useRef } from "react"

import { apiFetch } from "@/lib/api"

type UseWorkspaceContentSnapshotOptions = {
  enabled: boolean
  getContent: () => unknown
  workspaceId?: string | null
}

const snapshotDebounceMs = 800

export function useWorkspaceContentSnapshot({
  enabled,
  getContent,
  workspaceId,
}: UseWorkspaceContentSnapshotOptions) {
  const getContentRef = useRef(getContent)
  const timeoutRef = useRef<number | null>(null)
  const lastSentContentRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    getContentRef.current = getContent
  }, [getContent])

  const flushSnapshot = useCallback(async () => {
    if (!enabled || !workspaceId || inFlightRef.current) {
      return
    }

    const content = getContentRef.current()

    if (content === null || content === undefined) {
      return
    }

    const serialized = JSON.stringify(content)

    if (serialized === lastSentContentRef.current) {
      return
    }

    inFlightRef.current = true

    try {
      await apiFetch<{ workspace: unknown }>(
        `/workspaces/${encodeURIComponent(workspaceId)}/collaboration/snapshot`,
        {
          body: JSON.stringify({ content }),
          method: "POST",
        },
      )
      lastSentContentRef.current = serialized
    } catch (error) {
      console.error("Failed to persist workspace content snapshot", error)
    } finally {
      inFlightRef.current = false
    }
  }, [enabled, workspaceId])

  const scheduleSnapshot = useCallback(() => {
    if (!enabled || !workspaceId) {
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      void flushSnapshot()
    }, snapshotDebounceMs)
  }, [enabled, flushSnapshot, workspaceId])

  const flushPendingSnapshot = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    void flushSnapshot()
  }, [flushSnapshot])

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      lastSentContentRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }

      void flushSnapshot()
    }
  }, [flushSnapshot])

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSnapshot()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSnapshot()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [flushPendingSnapshot])

  return { flushPendingSnapshot, scheduleSnapshot }
}