import type { Feature, Tier } from "@zilobase/core-ports";

/**
 * The tier -> feature policy: the single place that decides which capabilities
 * each tier unlocks (Parnas: the most volatile business decision, hidden behind
 * one module). Re-tiering a feature is a one-line edit here.
 */
export const TIER_FEATURES: Record<Tier, readonly Feature[]> = {
  community: [],
  professional: [
    "sso.saml",
    "sso.oidc.enterprise",
    "rbac.custom",
    "branding.custom",
    "support.sla",
  ],
  enterprise: [
    "sso.saml",
    "sso.oidc.enterprise",
    "scim",
    "rbac.custom",
    "audit.log",
    "audit.export",
    "audit.legal_hold",
    "data.retention",
    "branding.custom",
    "branding.white_label",
    "security.byok",
    "ops.ha",
    "support.sla",
  ],
};

/** Total order over tiers, for `atLeast()` (tier-level gating). */
export const TIER_RANK: Record<Tier, number> = {
  community: 0,
  professional: 1,
  enterprise: 2,
};

export function featuresForTier(tier: Tier): readonly Feature[] {
  return TIER_FEATURES[tier] ?? [];
}
