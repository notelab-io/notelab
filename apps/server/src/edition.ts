/**
 * Edition composition seam.
 *
 * This is a community-neutral extension point: it contains NO enterprise code.
 * When `ZILOBASE_EDITION=enterprise` AND the private `@zilobase/ee` package is
 * installed (the Enterprise build composes it in), its plugin contributions are
 * loaded through a guarded dynamic import. In the Community build the package is
 * absent, the import fails, and the app runs unchanged.
 *
 * The license tier still decides Professional vs Enterprise at runtime — the EE
 * plugins self-gate against `getEntitlements()`.
 */
import { getEntitlements } from "./entitlements";

let eePlugins: unknown[] = [];
let initialized = false;

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
      }) => { plugins: unknown[] };
    };
    eePlugins = mod.registerEnterprise({ getEntitlements }).plugins ?? [];
    console.info(
      `[edition] Enterprise features loaded (${eePlugins.length} plugin(s)).`,
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
