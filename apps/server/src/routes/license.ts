import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";

import { verifyLicense, LicenseError } from "@zilobase/license";

import { db } from "../db";
import { instanceSetting, member } from "../db/schema";
import { getLicenseStatus, reloadEntitlements } from "../entitlements";
import { loadPersistedLicense, savePersistedLicense } from "../services/license-store";
import type { AppBindings } from "../types";

export const licenseRoutes = new Hono<AppBindings>();

async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), inArray(member.role, ["owner", "admin"])))
    .limit(1);
  return Boolean(row);
}

/** Stable per-instance id (for Prime machine binding). Generated once. */
async function getInstanceId(): Promise<string> {
  const [row] = await db
    .select({ value: instanceSetting.value })
    .from(instanceSetting)
    .where(eq(instanceSetting.key, "instance.id"))
    .limit(1);
  if (row?.value) return row.value;
  const id = "zilo-" + crypto.randomUUID();
  await db
    .insert(instanceSetting)
    .values({ key: "instance.id", value: id })
    .onConflictDoNothing();
  return (await getInstanceIdRaw()) ?? id;
}
async function getInstanceIdRaw(): Promise<string | null> {
  const [row] = await db
    .select({ value: instanceSetting.value })
    .from(instanceSetting)
    .where(eq(instanceSetting.key, "instance.id"))
    .limit(1);
  return row?.value ?? null;
}

function statusBody() {
  const s = getLicenseStatus();
  return {
    tier: s.tier,
    seats: s.seats,
    features: s.features,
    expiresAt: s.expiresAt,
    isTrial: s.isTrial,
    valid: s.valid,
    inGrace: s.inGrace,
    error: s.error,
  };
}

/** Sanitized license status for the client (no raw token). */
licenseRoutes.get("/", (c) => c.json(statusBody()));

/**
 * Activate a license (admin only). Two ways:
 *   { token }               — paste an offline signed key
 *   { code, primeUrl }      — activate via a Prime server (phone-home)
 * The signed token is verified locally, persisted, and applied at runtime.
 */
licenseRoutes.post("/activate", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  if (!(await isWorkspaceAdmin(user.id))) {
    return c.json({ error: "forbidden", message: "Workspace admin required." }, 403);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    token?: string;
    code?: string;
    primeUrl?: string;
  };

  let token = body.token?.trim();

  // Prime activation: exchange a code for a signed license.
  if (!token && body.code) {
    const primeUrl = (body.primeUrl || process.env.ZILOBASE_PRIME_URL || "").replace(/\/$/, "");
    if (!primeUrl) {
      return c.json({ error: "prime_url_missing" }, 400);
    }
    try {
      const instanceId = await getInstanceId();
      const resp = await fetch(`${primeUrl}/api/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: body.code, instanceId }),
      });
      const data = (await resp.json().catch(() => ({}))) as { license?: string; error?: string };
      if (!resp.ok || !data.license) {
        return c.json({ error: data.error || "activation_failed" }, 400);
      }
      token = data.license;
    } catch {
      return c.json({ error: "prime_unreachable" }, 502);
    }
  }

  if (!token) return c.json({ error: "no_token_or_code" }, 400);

  // Verify before persisting so a bad key is rejected with a clear reason.
  try {
    verifyLicense(token);
  } catch (error) {
    return c.json(
      { error: "invalid_license", message: error instanceof LicenseError ? error.message : "Invalid license." },
      400,
    );
  }

  await savePersistedLicense(token);
  reloadEntitlements(token);
  return c.json(statusBody());
});

/** Remove the license and fall back to Community (admin only). */
licenseRoutes.post("/deactivate", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  if (!(await isWorkspaceAdmin(user.id))) {
    return c.json({ error: "forbidden" }, 403);
  }
  await savePersistedLicense(null);
  reloadEntitlements(null);
  return c.json(statusBody());
});

/** Called on boot: apply the persisted license (falls back to env). */
export async function applyPersistedLicense(): Promise<void> {
  const persisted = await loadPersistedLicense();
  reloadEntitlements(persisted ?? process.env.ZILOBASE_LICENSE ?? null);
}
