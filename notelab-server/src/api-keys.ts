import type { Context } from "hono";

import type { AppBindings } from "./types";

export const API_KEY_PREFIX = "nl_";
export const API_KEY_DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 90;

export type ApiKeyMetadata = {
  organizationId?: unknown;
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

export function readApiKeyOrganizationId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const organizationId = (metadata as ApiKeyMetadata).organizationId;

  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
}

export function getApiKeyOrganizationId(c: Context<AppBindings>) {
  return c.get("apiKey")?.organizationId ?? null;
}

export function rejectMismatchedApiKeyOrganization(
  c: Context<AppBindings>,
  organizationId: string | null | undefined,
) {
  const pinnedOrganizationId = getApiKeyOrganizationId(c);

  if (!pinnedOrganizationId || !organizationId) {
    return null;
  }

  if (organizationId === pinnedOrganizationId) {
    return null;
  }

  return c.json(
    {
      error: "Forbidden",
      message: "API keys can only access the organization they were created for.",
    },
    403,
  );
}
