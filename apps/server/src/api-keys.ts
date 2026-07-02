import type { Context } from "hono";

import type { AppBindings } from "./types";

export const API_KEY_PREFIX = "nl_";
export const API_KEY_DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 90;

export type ApiKeyMetadata = {
  workspaceId?: unknown;
};

export function readApiKeyFromHeaders(headers: Headers) {
  const authorization = headers.get("authorization")?.trim();

  if (authorization) {
    const [scheme, ...rest] = authorization.split(/\s+/);

    if (scheme?.toLowerCase() === "bearer" && rest.length === 1) {
      return rest[0] ?? null;
    }
  }

  return headers.get("x-api-key")?.trim() || null;
}

export function readApiKeyWorkspaceId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const workspaceId = (metadata as ApiKeyMetadata).workspaceId;

  return typeof workspaceId === "string" && workspaceId.length > 0
    ? workspaceId
    : null;
}

export function getApiKeyWorkspaceId(c: Context<AppBindings>) {
  return c.get("apiKey")?.workspaceId ?? null;
}

export function rejectMismatchedApiKeyWorkspace(
  c: Context<AppBindings>,
  workspaceId: string | null | undefined,
) {
  const pinnedWorkspaceId = getApiKeyWorkspaceId(c);

  if (!pinnedWorkspaceId || !workspaceId) {
    return null;
  }

  if (workspaceId === pinnedWorkspaceId) {
    return null;
  }

  return c.json(
    {
      error: "Forbidden",
      message: "API keys can only access the workspace they were created for.",
    },
    403,
  );
}
