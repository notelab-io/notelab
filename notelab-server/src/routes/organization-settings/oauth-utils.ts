import { createHmac, timingSafeEqual } from "node:crypto";

import { getRequiredStringEnv } from "../../config";
import type {
  IntegrationKey,
  OAuthState,
  OrganizationSettingsContext,
  TokenResponse,
} from "./types";

export function getCallbackUrl(
  c: OrganizationSettingsContext,
  integration: IntegrationKey,
) {
  const url = new URL(c.req.url);

  return `${url.origin}/api/organization/settings/integrations/${integration}/callback`;
}

export function signState(c: OrganizationSettingsContext, payload: OAuthState) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getStateSecret(c))
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifyState(
  c: OrganizationSettingsContext,
  rawState: string,
): OAuthState | null {
  const [encoded, signature] = rawState.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getStateSecret(c))
    .update(encoded)
    .digest("base64url");
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    givenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(givenBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OAuthState;

    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export function oauthConfigError(code: string, message: string) {
  return { code, error: true as const, message };
}

export function withParams(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function postForm<T>(
  url: string,
  body: Record<string, string>,
  headers?: Record<string, string>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(body),
  });
  const data = (await response.json()) as T;

  if (!response.ok || (data as TokenResponse).error) {
    throw new Error((data as TokenResponse).error ?? "OAuth token exchange failed");
  }

  return data;
}

export async function fetchJson<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "notelab-server",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function assertAccessToken(token: TokenResponse) {
  if (!token.access_token) {
    throw new Error("OAuth provider did not return an access token.");
  }
}

function getStateSecret(c: OrganizationSettingsContext) {
  return getRequiredStringEnv(c.env, "OAUTH_STATE_SECRET");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
