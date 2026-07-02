import { Hono } from "hono";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { account } from "../db/schema";
import type { AppBindings } from "../types";

export const sessionRoutes = new Hono<AppBindings>();

sessionRoutes.get("/", async (c) => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user) {
    return c.json({ user: null, session: null }, 401);
  }

  return c.json({
    session,
    user: {
      ...user,
      hasPassword: await getUserHasPassword(user.id),
    },
  });
});

async function getUserHasPassword(userId: string) {
  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    )
    .limit(1);

  return Boolean(credentialAccount);
}
