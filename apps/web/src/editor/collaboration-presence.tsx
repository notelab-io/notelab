import { CloudOff, LoaderCircle } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import type { CollaborationUser } from "./use-page-collaboration"

export function CollaborationPresence({
  status,
  users,
}: {
  status: "connected" | "connecting" | "disconnected"
  users: CollaborationUser[]
}) {
  const visibleUsers = users.slice(0, 4)
  const hiddenCount = Math.max(0, users.length - visibleUsers.length)

  return (
    <div
      className="absolute right-4 top-4 z-10 flex h-8 items-center gap-2"
      contentEditable={false}
    >
      {status !== "connected" ? (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={status === "connecting" ? "Connecting" : "Offline"}
        >
          {status === "connecting" ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <CloudOff className="size-3" />
          )}
          {status === "connecting" ? "Connecting" : "Offline"}
        </span>
      ) : null}
      {visibleUsers.length > 0 ? (
        <AvatarGroup>
          {visibleUsers.map((user) => (
            <Avatar key={`${user.clientId}:${user.id}`} size="sm" title={user.name}>
              {user.avatar ? <AvatarImage alt="" src={user.avatar} /> : null}
              <AvatarFallback gradientSeed={user.id}>
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {hiddenCount > 0 ? (
            <AvatarGroupCount className="size-6 text-xs">
              +{hiddenCount}
            </AvatarGroupCount>
          ) : null}
        </AvatarGroup>
      ) : null}
    </div>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"
}
