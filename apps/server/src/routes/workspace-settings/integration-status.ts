import { hasOAuthConfig } from "./oauth";
import { getGmailIntegrationStatus } from "./gmail";
import { getGithubIntegrationStatus } from "./github";
import { getGoogleCalendarIntegrationStatus } from "./google-calendar";
import { getGoogleDriveIntegrationStatus } from "./google-drive";
import { getLinearIntegrationStatus } from "./linear";
import {
  getConnection,
  readObject,
  splitScopes,
} from "./shared";
import { getSlackIntegrationStatus } from "./slack";
import type { IntegrationKey, WorkspaceSettingsContext } from "./types";

export async function getIntegrationStatus(
  c: WorkspaceSettingsContext,
  integration: IntegrationKey,
  workspaceId: string,
  userId: string,
) {
  const connection = await getConnection(workspaceId, integration);
  const configured = hasOAuthConfig(c, integration);

  if (integration === "gmail") {
    return getGmailIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (integration === "github") {
    return getGithubIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (integration === "google-calendar") {
    return getGoogleCalendarIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (integration === "google-drive") {
    return getGoogleDriveIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (integration === "linear") {
    return getLinearIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (integration === "slack") {
    return getSlackIntegrationStatus(c, workspaceId, userId, connection);
  }

  if (!connection) {
    return {
      connected: false,
      configured,
      integration,
    };
  }

  const metadata = readObject(connection.metadata);
  const scopes = splitScopes(connection.scopes);

  return {
    connected: true,
    configured,
    connectedAt: connection.createdAt.toISOString(),
    displayName: connection.displayName,
    email: typeof metadata.email === "string" ? metadata.email : undefined,
    hostedDomain:
      typeof metadata.hostedDomain === "string" ? metadata.hostedDomain : undefined,
    connectedUserEmail:
      typeof metadata.connectedUserEmail === "string"
        ? metadata.connectedUserEmail
        : undefined,
    connectedUserId: metadata.connectedUserId,
    connectedUserLogin:
      typeof metadata.connectedUserLogin === "string"
        ? metadata.connectedUserLogin
        : undefined,
    connectedUserName:
      typeof metadata.connectedUserName === "string"
        ? metadata.connectedUserName
        : undefined,
    enterpriseId:
      typeof metadata.enterpriseId === "string" ? metadata.enterpriseId : undefined,
    enterpriseName:
      typeof metadata.enterpriseName === "string"
        ? metadata.enterpriseName
        : undefined,
    integration,
    workspaceUrlKey:
      typeof metadata.workspaceUrlKey === "string"
        ? metadata.workspaceUrlKey
        : undefined,
    providerAccountId: connection.providerAccountId,
    scopes,
    status: connection.status,
    teamId: typeof metadata.teamId === "string" ? metadata.teamId : undefined,
    teamName: typeof metadata.teamName === "string" ? metadata.teamName : undefined,
    updatedAt: connection.updatedAt.toISOString(),
  };
}
