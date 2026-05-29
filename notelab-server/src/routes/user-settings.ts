import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userSettings } from "../db/schema";
import type { AppBindings } from "../types";

export const userSettingsRoutes = new Hono<AppBindings>();

type UserSettingsPayload = {
  workspaceFullWidth: boolean;
};

userSettingsRoutes.get("/", async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json({ settings: await getOrCreateUserSettings(user.id) });
});

userSettingsRoutes.patch("/", async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "A JSON body is required" }, 400);
  }

  const patch = body as { workspaceFullWidth?: unknown };
  const values: Partial<typeof userSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.workspaceFullWidth !== undefined) {
    if (typeof patch.workspaceFullWidth !== "boolean") {
      return c.json({ error: "workspaceFullWidth must be a boolean" }, 400);
    }

    values.workspaceFullWidth = patch.workspaceFullWidth;
  }

  const [settings] = await db
    .insert(userSettings)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      workspaceFullWidth: values.workspaceFullWidth ?? false,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: values,
    })
    .returning();

  return c.json({ settings: toUserSettingsPayload(settings) });
});

async function getOrCreateUserSettings(userId: string) {
  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existing) {
    return toUserSettingsPayload(existing);
  }

  const [created] = await db
    .insert(userSettings)
    .values({
      id: crypto.randomUUID(),
      userId,
    })
    .returning();

  return toUserSettingsPayload(created);
}

function toUserSettingsPayload(
  settings: typeof userSettings.$inferSelect,
): UserSettingsPayload {
  return {
    workspaceFullWidth: settings.workspaceFullWidth,
  };
}
