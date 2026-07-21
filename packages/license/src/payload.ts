import type { Feature, Tier } from "@zilobase/core-ports";

/** The signed contents of a license token. */
export interface LicensePayload {
  /** Payload schema version. */
  readonly v: 1;
  readonly licenseId: string;
  readonly customer: string;
  readonly tier: Tier;
  /** Maximum seats; `null` means unlimited. */
  readonly seats: number | null;
  /** Optional add-on features granted beyond the tier defaults. */
  readonly features?: readonly Feature[];
  /** epoch ms */
  readonly issuedAt: number;
  /** epoch ms; `null` means perpetual. */
  readonly expiresAt: number | null;
  /** Time-limited trial (still fully functional). Defaults to false. */
  readonly isTrial?: boolean;
  /**
   * epoch ms; features keep working between `expiresAt` and `graceUntil` (a
   * warn-then-block window, like GitLab's block_changes_at). After it, verify
   * hard-fails. `null`/absent means no grace (hard-stop at `expiresAt`).
   */
  readonly graceUntil?: number | null;
  /** Optional binding to stop key sharing (Plane-style 1 key : 1 instance). */
  readonly instanceId?: string;
}
