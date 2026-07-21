import { eq } from "drizzle-orm";

import { db } from "../db";
import { instanceSetting } from "../db/schema";

const LICENSE_KEY = "license.token";

/** Read the persisted license token (admin-uploaded), if any. */
export async function loadPersistedLicense(): Promise<string | null> {
  const [row] = await db
    .select({ value: instanceSetting.value })
    .from(instanceSetting)
    .where(eq(instanceSetting.key, LICENSE_KEY))
    .limit(1);
  return row?.value ?? null;
}

/** Persist (or clear) the license token so it survives restarts. */
export async function savePersistedLicense(token: string | null): Promise<void> {
  if (token === null) {
    await db.delete(instanceSetting).where(eq(instanceSetting.key, LICENSE_KEY));
    return;
  }
  await db
    .insert(instanceSetting)
    .values({ key: LICENSE_KEY, value: token, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: instanceSetting.key,
      set: { value: token, updatedAt: new Date() },
    });
}
