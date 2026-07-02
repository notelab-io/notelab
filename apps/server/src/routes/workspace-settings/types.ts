import type { Context } from "hono";

import type { AppBindings } from "../../types";

export type IntegrationKey =
  | "gmail"
  | "github"
  | "google-calendar"
  | "google-drive"
  | "linear"
  | "slack";

export type OAuthState = {
  exp: number;
  enforceEmailMatch?: boolean;
  githubWorkspaceLogin?: string;
  integration: IntegrationKey;
  mode?: "personal" | "page";
  workspaceId: string;
  userId: string;
  coworkerCalendarAccessEnabled?: boolean;
};

export type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string };
  enterprise?: { id?: string; name?: string };
  is_enterprise_install?: boolean;
  authed_user?: {
    access_token?: string;
    expires_in?: number;
    id?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
  error?: string;
};

export type WorkspaceSettingsContext = Context<AppBindings>;

export const integrationKeys = new Set<IntegrationKey>([
  "gmail",
  "github",
  "google-calendar",
  "google-drive",
  "linear",
  "slack",
]);

export const googleScopes = {
  gmail: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  "google-calendar": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ],
  "google-calendar-coworkers": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
  "google-drive": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
} as const;

export class OAuthCallbackError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "OAuthCallbackError";
  }
}
