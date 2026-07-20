export { TIER_FEATURES, TIER_RANK, featuresForTier } from "./tiers.ts";
export { signLicense } from "./sign.ts";
export { verifyLicense, isInGrace, LicenseError, type VerifyOptions } from "./verify.ts";
export {
  COMMUNITY_ENTITLEMENTS,
  entitlementsFromPayload,
  loadEntitlements,
  createLicenseResolver,
} from "./entitlements.ts";
export { EMBEDDED_PUBLIC_KEY } from "./keys.ts";
export type { LicensePayload } from "./payload.ts";
