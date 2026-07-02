import { and, eq } from "drizzle-orm";

import { getMembership } from "../../access";
import { db } from "../../db";
import {
  workspaceIntegration,
  user,
  userIntegration,
} from "../../db/schema";
import { integrationKeys } from "./types";
import type { IntegrationKey, WorkspaceSettingsContext } from "./types";

export async function requireActiveWorkspace(c: WorkspaceSettingsContext) {
  const user = c.get("user");
  const session = c.get("session");
  const workspaceId =
    session?.activeWorkspaceId ??
    c.req.header("x-notelab-workspace-id")?.trim();

  if (!user) {
    return { response: c.json({ error: "Unauthorized" }, 401) };
  }

  if (!workspaceId) {
    return { response: c.json({ error: "No active workspace" }, 409) };
  }

  const membership = await getMembership(workspaceId, user.id);

  if (!membership) {
    return { response: c.json({ error: "Forbidden" }, 403) };
  }

  return { membership, workspaceId, user };
}

export function readIntegration(c: WorkspaceSettingsContext) {
  const value = c.req.param("integration") as IntegrationKey;

  return integrationKeys.has(value) ? value : null;
}

export async function getConnection(
  workspaceId: string,
  integration: IntegrationKey,
) {
  const [connection] = await db
    .select()
    .from(workspaceIntegration)
    .where(
      and(
        eq(workspaceIntegration.workspaceId, workspaceId),
        eq(workspaceIntegration.integrationKey, integration),
      ),
    )
    .limit(1);

  return connection ?? null;
}

export async function getUserConnection(
  workspaceId: string,
  userId: string,
  integration: IntegrationKey,
) {
  const [connection] = await db
    .select()
    .from(userIntegration)
    .where(
      and(
        eq(userIntegration.workspaceId, workspaceId),
        eq(userIntegration.userId, userId),
        eq(userIntegration.integrationKey, integration),
      ),
    )
    .limit(1);

  return connection ?? null;
}

export async function getUserRecord(userId: string) {
  const [record] = await db
    .select({
      email: user.email,
      id: user.id,
      name: user.name,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return record ?? null;
}

export function splitScopes(scopes: string | null) {
  return scopes?.split(/\s+/).filter(Boolean) ?? [];
}

export function readIntegrationMode(body: unknown): "personal" | "page" {
  return readObject(body).mode === "personal" ? "personal" : "page";
}

export function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return normalizeEmail(left) !== null && normalizeEmail(left) === normalizeEmail(right);
}

export function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  return normalized ? normalized : null;
}
