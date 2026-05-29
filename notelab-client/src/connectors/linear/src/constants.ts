export const LINEAR_API_BASE_URL = "https://api.linear.app";
export const LINEAR_OAUTH_AUTHORIZE_URL =
  "https://linear.app/oauth/authorize";
export const LINEAR_OAUTH_TOKEN_URL = `${LINEAR_API_BASE_URL}/oauth/token`;
export const LINEAR_OAUTH_REVOKE_URL = `${LINEAR_API_BASE_URL}/oauth/revoke`;

export const LINEAR_CONNECTOR_SCOPES = ["read"] as const;
