import { and, eq } from "drizzle-orm";

import { getMembership } from "../../access";
import { db } from "../../db";
import {
  organizationIntegration,
  user,
  userIntegration,
} from "../../db/schema";
import { integrationKeys } from "./types";
import type { IntegrationKey, OrganizationSettingsContext } from "./types";

export async function requireActiveOrganization(c: OrganizationSettingsContext) {
  const user = c.get("user");
  const session = c.get("session");
  const organizationId =
    session?.activeOrganizationId ??
    c.req.header("x-notelab-organization-id")?.trim();

  if (!user) {
    return { response: c.json({ error: "Unauthorized" }, 401) };
  }

  if (!organizationId) {
    return { response: c.json({ error: "No active organization" }, 409) };
  }

  const membership = await getMembership(organizationId, user.id);

  if (!membership) {
    return { response: c.json({ error: "Forbidden" }, 403) };
  }

  return { membership, organizationId, user };
}

export function readIntegration(c: OrganizationSettingsContext) {
  const value = c.req.param("integration") as IntegrationKey;

  return integrationKeys.has(value) ? value : null;
}

export async function getConnection(
  organizationId: string,
  integration: IntegrationKey,
) {
  const [connection] = await db
    .select()
    .from(organizationIntegration)
    .where(
      and(
        eq(organizationIntegration.organizationId, organizationId),
        eq(organizationIntegration.integrationKey, integration),
      ),
    )
    .limit(1);

  return connection ?? null;
}

export async function getUserConnection(
  organizationId: string,
  userId: string,
  integration: IntegrationKey,
) {
  const [connection] = await db
    .select()
    .from(userIntegration)
    .where(
      and(
        eq(userIntegration.organizationId, organizationId),
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

export function readIntegrationMode(body: unknown): "personal" | "workspace" {
  return readObject(body).mode === "personal" ? "personal" : "workspace";
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
