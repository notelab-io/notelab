import { getPrimaryClientOrigin } from "../../config";
import {
  createGmailOAuthUrl,
  handleGmailOAuthCallback,
  hasGmailOAuthConfig,
} from "./gmail";
import {
  createGithubOAuthUrl,
  handleGithubOAuthCallback,
  hasGithubOAuthConfig,
} from "./github";
import {
  createGoogleCalendarOAuthUrl,
  handleGoogleCalendarOAuthCallback,
  hasGoogleCalendarOAuthConfig,
} from "./google-calendar";
import {
  createGoogleDriveOAuthUrl,
  handleGoogleDriveOAuthCallback,
  hasGoogleDriveOAuthConfig,
} from "./google-drive";
import {
  createLinearOAuthUrl,
  handleLinearOAuthCallback,
  hasLinearOAuthConfig,
} from "./linear";
import {
  getCallbackUrl,
  verifyState,
} from "./oauth-utils";
import {
  createSlackOAuthUrl,
  handleSlackOAuthCallback,
  hasSlackOAuthConfig,
} from "./slack";
import {
  OAuthCallbackError,
  type IntegrationKey,
  type OrganizationSettingsContext,
} from "./types";

export async function createOAuthUrl(
  c: OrganizationSettingsContext,
  integration: IntegrationKey,
  input: {
    coworkerCalendarAccessEnabled: boolean;
    enforceEmailMatch: boolean;
    mode: "personal" | "workspace";
    organizationId: string;
    userId: string;
  },
) {
  if (integration === "gmail") {
    return createGmailOAuthUrl(c, input);
  }

  if (integration === "github") {
    return createGithubOAuthUrl(c, {
      ...input,
      githubOrganizationLogin:
        readOptionalString(input, "githubOrganizationLogin") ??
        readOptionalString(input, "organizationLogin"),
    });
  }

  if (integration === "google-calendar") {
    return createGoogleCalendarOAuthUrl(c, input);
  }

  if (integration === "google-drive") {
    return createGoogleDriveOAuthUrl(c, input);
  }

  if (integration === "linear") {
    return createLinearOAuthUrl(c, input);
  }

  if (integration === "slack") {
    return createSlackOAuthUrl(c, input);
  }

  return {
    code: "UNSUPPORTED_INTEGRATION",
    error: true as const,
    message: "Unsupported integration.",
  };
}

export async function handleOAuthCallback(
  c: OrganizationSettingsContext,
  integration: IntegrationKey,
) {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const rawState = c.req.query("state");

  if (error) {
    return c.redirect(oauthResultUrl(c, integration, "error", error));
  }

  if (!code || !rawState) {
    return c.redirect(oauthResultUrl(c, integration, "error", "missing_oauth_callback"));
  }

  const state = verifyState(c, rawState);

  if (!state || state.integration !== integration) {
    return c.redirect(oauthResultUrl(c, integration, "error", "invalid_oauth_state"));
  }

  try {
    if (integration === "gmail") {
      await handleGmailOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }

    if (integration === "github") {
      await handleGithubOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }

    if (integration === "google-calendar") {
      await handleGoogleCalendarOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }

    if (integration === "google-drive") {
      await handleGoogleDriveOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }

    if (integration === "linear") {
      await handleLinearOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }

    if (integration === "slack") {
      await handleSlackOAuthCallback(c, code, state);

      return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
    }
  } catch (exchangeError) {
    console.error("OAuth callback failed", integration, exchangeError);

    return c.redirect(
      oauthResultUrl(
        c,
        integration,
        "error",
        exchangeError instanceof OAuthCallbackError
          ? exchangeError.code
          : "oauth_callback_failed",
      ),
    );
  }
}

export function oauthResultUrl(
  c: OrganizationSettingsContext,
  integration: IntegrationKey,
  result: "error" | "success",
  code: string,
) {
  const paramName =
    integration === "google-calendar"
      ? "googleCalendar"
      : integration === "google-drive"
        ? "googleDrive"
        : integration;
  const url = new URL("/settings/integrations", getPrimaryClientOrigin(c.env));

  url.searchParams.set(paramName, result);
  url.searchParams.set("code", code);

  return url.toString();
}

export function hasOAuthConfig(
  c: OrganizationSettingsContext,
  integration: IntegrationKey,
) {
  if (integration === "github") {
    return hasGithubOAuthConfig(c);
  }

  if (integration === "gmail") {
    return hasGmailOAuthConfig(c);
  }

  if (integration === "google-drive") {
    return hasGoogleDriveOAuthConfig(c);
  }

  if (integration === "google-calendar") {
    return hasGoogleCalendarOAuthConfig(c);
  }

  if (integration === "slack") {
    return hasSlackOAuthConfig(c);
  }

  if (integration === "linear") {
    return hasLinearOAuthConfig(c);
  }
}

function readOptionalString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const property = (value as Record<string, unknown>)[key];

  return typeof property === "string" && property.trim()
    ? property.trim()
    : undefined;
}
