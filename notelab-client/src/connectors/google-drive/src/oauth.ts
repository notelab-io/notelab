import {
  GOOGLE_DRIVE_CONNECTOR_SCOPES,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_TOKEN_URL,
} from "./constants.js";
import { GoogleDriveConnectorError } from "./errors.js";
import { resolveFetch, type GoogleDriveFetch } from "./fetch.js";
import type {
  GoogleDriveConnectorScope,
  GoogleDriveOAuthTokenResponse,
  GoogleIdTokenClaims,
} from "./types.js";

export type CreateGoogleDriveOAuthUrlOptions = {
  clientId: string;
  hostedDomain?: string;
  loginHint?: string;
  prompt?: "consent" | "none" | "select_account";
  redirectUri: string;
  scopes?: readonly GoogleDriveConnectorScope[];
  state: string;
};

export function createGoogleDriveOAuthUrl({
  clientId,
  hostedDomain,
  loginHint,
  prompt = "consent",
  redirectUri,
  scopes = GOOGLE_DRIVE_CONNECTOR_SCOPES,
  state,
}: CreateGoogleDriveOAuthUrlOptions) {
  const url = new URL(GOOGLE_OAUTH_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", prompt);

  if (hostedDomain) {
    url.searchParams.set("hd", hostedDomain);
  }

  if (loginHint) {
    url.searchParams.set("login_hint", loginHint);
  }

  return url.toString();
}

export type ExchangeGoogleDriveOAuthCodeOptions = {
  clientId: string;
  clientSecret: string;
  code: string;
  fetch?: GoogleDriveFetch;
  redirectUri: string;
};

export async function exchangeGoogleDriveOAuthCode({
  clientId,
  clientSecret,
  code,
  fetch: fetchImpl,
  redirectUri,
}: ExchangeGoogleDriveOAuthCodeOptions): Promise<GoogleDriveOAuthTokenResponse> {
  const response = await resolveFetch(fetchImpl)(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new GoogleDriveConnectorError(
      "Failed to exchange Google Drive OAuth code.",
      {
        code: "GOOGLE_DRIVE_OAUTH_EXCHANGE_FAILED",
        status: response.status,
      },
    );
  }

  return response.json() as Promise<GoogleDriveOAuthTokenResponse>;
}

export type RefreshGoogleDriveAccessTokenOptions = {
  clientId: string;
  clientSecret: string;
  fetch?: GoogleDriveFetch;
  refreshToken: string;
};

export async function refreshGoogleDriveAccessToken({
  clientId,
  clientSecret,
  fetch: fetchImpl,
  refreshToken,
}: RefreshGoogleDriveAccessTokenOptions): Promise<GoogleDriveOAuthTokenResponse> {
  const response = await resolveFetch(fetchImpl)(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new GoogleDriveConnectorError(
      "Failed to refresh Google Drive access token.",
      {
        code: "GOOGLE_DRIVE_OAUTH_REFRESH_FAILED",
        status: response.status,
      },
    );
  }

  return response.json() as Promise<GoogleDriveOAuthTokenResponse>;
}

export function decodeGoogleIdTokenClaims(idToken: string): GoogleIdTokenClaims {
  const [, payload] = idToken.split(".");

  if (!payload) {
    throw new GoogleDriveConnectorError("Invalid Google ID token.", {
      code: "GOOGLE_DRIVE_INVALID_ID_TOKEN",
    });
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as GoogleIdTokenClaims;
  } catch {
    throw new GoogleDriveConnectorError("Invalid Google ID token payload.", {
      code: "GOOGLE_DRIVE_INVALID_ID_TOKEN_PAYLOAD",
    });
  }
}

export function getHostedDomainFromClaims(claims: GoogleIdTokenClaims) {
  return claims.hd?.trim() || claims.email?.split("@")[1]?.trim() || undefined;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  if (typeof atob !== "function") {
    throw new GoogleDriveConnectorError("Base64 decoding is not available.", {
      code: "GOOGLE_DRIVE_BASE64_DECODER_UNAVAILABLE",
    });
  }

  return atob(padded);
}
