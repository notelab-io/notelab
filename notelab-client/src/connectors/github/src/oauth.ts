import {
  GITHUB_CONNECTOR_SCOPES,
  GITHUB_OAUTH_AUTHORIZE_URL,
  GITHUB_OAUTH_TOKEN_URL,
} from "./constants.js";
import { GithubConnectorError } from "./errors.js";
import { resolveFetch, type GithubFetch } from "./fetch.js";
import type { GithubConnectorScope, GithubOAuthTokenResponse } from "./types.js";

export type CreateGithubOAuthUrlOptions = {
  allowSignup?: boolean;
  clientId: string;
  login?: string;
  redirectUri: string;
  scopes?: readonly GithubConnectorScope[];
  state: string;
};

export function createGithubOAuthUrl({
  allowSignup,
  clientId,
  login,
  redirectUri,
  scopes = GITHUB_CONNECTOR_SCOPES,
  state,
}: CreateGithubOAuthUrlOptions) {
  const url = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);

  if (allowSignup !== undefined) {
    url.searchParams.set("allow_signup", String(allowSignup));
  }

  if (login) {
    url.searchParams.set("login", login);
  }

  return url.toString();
}

export type ExchangeGithubOAuthCodeOptions = {
  clientId: string;
  clientSecret: string;
  code: string;
  fetch?: GithubFetch;
  redirectUri: string;
};

export async function exchangeGithubOAuthCode({
  clientId,
  clientSecret,
  code,
  fetch: fetchImpl,
  redirectUri,
}: ExchangeGithubOAuthCodeOptions): Promise<GithubOAuthTokenResponse> {
  const response = await resolveFetch(fetchImpl)(GITHUB_OAUTH_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new GithubConnectorError("Failed to exchange GitHub OAuth code.", {
      code: "GITHUB_OAUTH_EXCHANGE_FAILED",
      status: response.status,
    });
  }

  const token = (await response.json()) as GithubOAuthTokenResponse;

  if (token.error || !token.access_token) {
    throw new GithubConnectorError(
      token.error_description || "Failed to exchange GitHub OAuth code.",
      {
        code: token.error ?? "GITHUB_OAUTH_EXCHANGE_FAILED",
        status: response.status,
      },
    );
  }

  return token;
}
