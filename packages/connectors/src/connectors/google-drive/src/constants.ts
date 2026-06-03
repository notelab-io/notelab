export const GOOGLE_DRIVE_API_BASE_URL =
  "https://www.googleapis.com/drive/v3";

export const GOOGLE_DRIVE_GOOGLE_OAUTH_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_DRIVE_GOOGLE_OAUTH_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export const GOOGLE_DRIVE_METADATA_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly";

export const GOOGLE_DRIVE_GOOGLE_IDENTITY_SCOPES = [
  "openid",
  "email",
  "profile",
] as const;

export const GOOGLE_DRIVE_CONNECTOR_SCOPES = [
  ...GOOGLE_DRIVE_GOOGLE_IDENTITY_SCOPES,
  GOOGLE_DRIVE_READONLY_SCOPE,
  GOOGLE_DRIVE_METADATA_READONLY_SCOPE,
] as const;
