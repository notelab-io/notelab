import type { Entitlements, Feature, Tier } from "@zilobase/core-ports";
import {
  loadEntitlements,
  verifyLicense,
  isInGrace,
  LicenseError,
} from "@zilobase/license";

/**
 * License status + entitlements for the running instance.
 *
 * Community-neutral: with no license this reports the Community tier. The token
 * comes from `ZILOBASE_LICENSE` for now; once the admin console can upload a
 * key, `reloadEntitlements()` swaps it at runtime without a restart.
 *
 * Verified on boot and re-verified periodically (see startLicenseRevalidation)
 * so an expired key downgrades to Community mid-run.
 */
export interface LicenseStatus {
  tier: Tier;
  seats: number | null;
  features: readonly Feature[];
  /** epoch ms; null = perpetual/none. */
  expiresAt: number | null;
  isTrial: boolean;
  /** The token verified cleanly (signature + not past grace). */
  valid: boolean;
  /** Past `expiresAt` but still inside the grace window. */
  inGrace: boolean;
  /** Human-readable problem when a token was present but rejected. */
  error: string | null;
}

let currentToken: string | null = process.env.ZILOBASE_LICENSE ?? null;
let cached: Entitlements | null = null;
let cachedStatus: LicenseStatus | null = null;

function computeStatus(token: string | null): {
  entitlements: Entitlements;
  status: LicenseStatus;
} {
  const entitlements = loadEntitlements(token);
  const base: LicenseStatus = {
    tier: entitlements.tier,
    seats: entitlements.seats,
    features: entitlements.features,
    expiresAt: entitlements.expiresAt,
    isTrial: entitlements.isTrial,
    valid: entitlements.tier !== "community" ? true : token ? false : true,
    inGrace: false,
    error: null,
  };

  if (!token) {
    return { entitlements, status: { ...base, valid: true } };
  }

  try {
    const payload = verifyLicense(token);
    return {
      entitlements,
      status: { ...base, valid: true, inGrace: isInGrace(payload) },
    };
  } catch (error) {
    // Token present but rejected — loadEntitlements already fell back to
    // Community; surface the reason for the admin.
    return {
      entitlements,
      status: {
        ...base,
        valid: false,
        error:
          error instanceof LicenseError ? error.message : "Invalid license.",
      },
    };
  }
}

function refresh(): void {
  const { entitlements, status } = computeStatus(currentToken);
  cached = entitlements;
  cachedStatus = status;
}

export function getEntitlements(): Entitlements {
  if (!cached) refresh();
  return cached as Entitlements;
}

export function getLicenseStatus(): LicenseStatus {
  if (!cachedStatus) refresh();
  return cachedStatus as LicenseStatus;
}

/** Swap the license token at runtime (admin upload) and re-verify. */
export function reloadEntitlements(token: string | null): Entitlements {
  currentToken = token;
  refresh();
  return cached as Entitlements;
}

export interface RevalidationOptions {
  intervalMs?: number;
  /**
   * Returns the current active-user count for a seat check. The licensing
   * framework stays DB-agnostic; the host (which has DB access) supplies this.
   * Over-limit is a soft, non-blocking warning.
   */
  countActiveUsers?: () => Promise<number>;
}

async function runSeatCheck(count?: () => Promise<number>): Promise<void> {
  if (!count || !cached || cached.seats === null) return;
  try {
    const active = await count();
    if (!cached.withinSeatLimit(active)) {
      console.warn(
        `[license] seat limit exceeded: ${active} active users vs ${cached.seats} licensed. ` +
          `Contact sales to add seats (access is not blocked).`,
      );
    }
  } catch {
    // never let a seat check break the app
  }
}

/**
 * Periodically re-verify the license so an expired/rotated key takes effect
 * without a restart, and run a soft
 * seat check. Returns a stop function. Default: every 6 hours.
 */
export function startLicenseRevalidation(options: RevalidationOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 6 * 60 * 60 * 1000;
  refresh();
  void runSeatCheck(options.countActiveUsers);
  const timer = setInterval(() => {
    const before = cachedStatus?.tier;
    refresh();
    if (cachedStatus && cachedStatus.tier !== before) {
      console.info(
        `[license] entitlements changed on re-check: ${before} -> ${cachedStatus.tier}` +
          (cachedStatus.error ? ` (${cachedStatus.error})` : ""),
      );
    }
    void runSeatCheck(options.countActiveUsers);
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
