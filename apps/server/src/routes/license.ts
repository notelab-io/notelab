import { Hono } from "hono";

import { getLicenseStatus } from "../entitlements";
import type { AppBindings } from "../types";

export const licenseRoutes = new Hono<AppBindings>();

/**
 * Sanitized license status for the current instance (like Mattermost's
 * GetSanitizedClientLicense / GitLab's glFeatures). Never exposes the raw token
 * or signature — only tier, seats, features, expiry, and validity — so the UI
 * can render feature gates and upgrade prompts.
 */
licenseRoutes.get("/", (c) => {
  const s = getLicenseStatus();
  return c.json({
    tier: s.tier,
    seats: s.seats,
    features: s.features,
    expiresAt: s.expiresAt,
    isTrial: s.isTrial,
    valid: s.valid,
    inGrace: s.inGrace,
    error: s.error,
  });
});
