import {
  LINEAR_CONNECTOR_SCOPES,
  LINEAR_OAUTH_AUTHORIZE_URL,
  LINEAR_OAUTH_REVOKE_URL,
  LINEAR_OAUTH_TOKEN_URL,
} from "./constants.js";
import { LinearConnectorError } from "./errors.js";
import { resolveFetch, type LinearFetch } from "./fetch.js";
import type { LinearConnectorScope, LinearOAuthTokenResponse } from "./types.js";

export type CreateLinearOAuthUrlOptions = {
  actor?: "app" | "user";
  clientId: string;
  prompt?: "consent";
  redirectUri: string;
  scopes?: readonly LinearConnectorScope[];
  state: string;
};

export function createLinearOAuthUrl({
  actor,
  clientId,
  prompt,
  redirectUri,
  scopes = LINEAR_CONNECTOR_SCOPES,
  state,
}: CreateLinearOAuthUrlOptions) {
  const url = new URL(LINEAR_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("state", state);

  if (actor) {
    url.searchParams.set("actor", actor);
  }

  if (prompt) {
    url.searchParams.set("prompt", prompt);
  }

  return url.toString();
}

export type ExchangeLinearOAuthCodeOptions = {
  clientId: string;
  clientSecret: string;
  code: string;
  fetch?: LinearFetch;
  redirectUri: string;
};

export async function exchangeLinearOAuthCode({
  clientId,
  clientSecret,
  code,
  fetch: fetchImpl,
  redirectUri,
}: ExchangeLinearOAuthCodeOptions): Promise<LinearOAuthTokenResponse> {
  return postLinearOAuth({
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    errorCode: "LINEAR_OAUTH_EXCHANGE_FAILED",
    errorMessage: "Failed to exchange Linear OAuth code.",
    fetch: fetchImpl,
  });
}

export type RefreshLinearAccessTokenOptions = {
  clientId: string;
  clientSecret: string;
  fetch?: LinearFetch;
  refreshToken: string;
};

export async function refreshLinearAccessToken({
  clientId,
  clientSecret,
  fetch: fetchImpl,
  refreshToken,
}: RefreshLinearAccessTokenOptions): Promise<LinearOAuthTokenResponse> {
  return postLinearOAuth({
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    errorCode: "LINEAR_OAUTH_REFRESH_FAILED",
    errorMessage: "Failed to refresh Linear access token.",
    fetch: fetchImpl,
  });
}

export type RevokeLinearTokenOptions = {
  clientId: string;
  clientSecret: string;
  fetch?: LinearFetch;
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
};

export async function revokeLinearToken({
  clientId,
  clientSecret,
  fetch: fetchImpl,
  token,
  tokenTypeHint,
}: RevokeLinearTokenOptions) {
  const body = new URLSearchParams({ token });

  if (tokenTypeHint) {
    body.set("token_type_hint", tokenTypeHint);
  }

  const response = await resolveFetch(fetchImpl)(LINEAR_OAUTH_REVOKE_URL, {
    method: "POST",
    body,
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new LinearConnectorError("Failed to revoke Linear OAuth token.", {
      code: "LINEAR_OAUTH_REVOKE_FAILED",
      status: response.status,
    });
  }
}

async function postLinearOAuth({
  body,
  errorCode,
  errorMessage,
  fetch: fetchImpl,
}: {
  body: URLSearchParams;
  errorCode: string;
  errorMessage: string;
  fetch?: LinearFetch;
}) {
  const response = await resolveFetch(fetchImpl)(LINEAR_OAUTH_TOKEN_URL, {
    method: "POST",
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new LinearConnectorError(errorMessage, {
      code: errorCode,
      status: response.status,
    });
  }

  const token = (await response.json()) as LinearOAuthTokenResponse;

  if (token.error || !token.access_token) {
    throw new LinearConnectorError(token.error_description || errorMessage, {
      code: token.error ?? errorCode,
      status: response.status,
    });
  }

  return token;
}
