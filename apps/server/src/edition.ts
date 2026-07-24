/**
 * Edition composition seam.
 *
 * This is a community-neutral extension point: it contains NO enterprise code.
 * When `ZILOBASE_EDITION=enterprise` AND the private `@zilobase/ee` package is
 * installed (the Enterprise build composes it in), its contributions are loaded
 * through a guarded dynamic import. In the Community build the package is
 * absent, the import fails, and the app runs unchanged.
 *
 * Contributions:
 * - Better Auth plugins (SSO, …) — self-gate on the active license
 * - Admin Hono routes — mounted at `/api/admin` by `registerRoutes`
 *
 * The license tier still decides Professional vs Enterprise at runtime.
 */
import type { Hono } from "hono";

import { getEntitlements } from "./entitlements";
import type { AppBindings } from "./types";

let eePlugins: unknown[] = [];
/** Admin API surface contributed by EE (mounted at `/api/admin`). */
let eeAdminRoutes: Hono<AppBindings> | null = null;
let initialized = false;

export type EnterpriseContribution = {
  plugins?: unknown[];
  /**
   * Hono app mounted at `/api/admin`. Keep routes relative
   * (e.g. `GET /health` → `/api/admin/health`).
   */
  adminRoutes?: Hono<AppBindings> | Hono;
};

export async function initEdition(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (process.env.ZILOBASE_EDITION !== "enterprise") return;

  try {
    // Indirect specifier so the Community build never statically resolves a
    // package that is only present in the Enterprise build.
    const specifier = "@zilobase/ee";
    const mod = (await import(specifier)) as {
      registerEnterprise: (ctx: {
        getEntitlements: typeof getEntitlements;
      }) => EnterpriseContribution;
    };
    const contribution = mod.registerEnterprise({ getEntitlements });
    eePlugins = contribution.plugins ?? [];
    eeAdminRoutes = (contribution.adminRoutes as Hono<AppBindings> | undefined) ?? null;
    console.info(
      `[edition] Enterprise features loaded` +
        ` (${eePlugins.length} auth plugin(s)` +
        (eeAdminRoutes ? ", admin routes" : "") +
        `).`,
    );
  } catch (error) {
    console.warn(
      "[edition] ZILOBASE_EDITION=enterprise but @zilobase/ee is unavailable; running Community.",
      error,
    );
  }
}

/** Better Auth plugins contributed by the Enterprise edition (empty in Community). */
export function getEEPlugins(): unknown[] {
  return eePlugins;
}

/**
 * Admin route tree contributed by EE. `null` in Community or when EE did not
 * supply routes. Call only after `initEdition()` (server bootstrap does).
 */
export function getEEAdminRoutes(): Hono<AppBindings> | null {
  return eeAdminRoutes;
}

/** Test helper: reset edition state between tests. */
export function resetEditionForTests(): void {
  eePlugins = [];
  eeAdminRoutes = null;
  initialized = false;
}
