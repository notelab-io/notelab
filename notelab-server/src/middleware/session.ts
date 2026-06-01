import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import {
  readApiKeyFromHeaders,
  readApiKeyOrganizationId,
} from "../api-keys";
import { createAuth } from "../auth";
import { getMembership } from "../access";
import { createDbClient, runWithDbClient } from "../db";
import { db } from "../db";
import { user as userTable } from "../db/schema";
import type { AppBindings } from "../types";

export const sessionMiddleware: MiddlewareHandler<AppBindings> = async (
  c,
  next,
) => {
  const dbClient = createDbClient(c.env);

  return await runWithDbClient(dbClient, async () => {
    c.set("apiKey", null);
    c.set("authMethod", null);

    const rawApiKey = readApiKeyFromHeaders(c.req.raw.headers);
    const auth = createAuth(c.env, c.req.raw);

    if (rawApiKey) {
      const verification = await auth.api.verifyApiKey({
        body: { key: rawApiKey },
      });

      if (!verification.valid || !verification.key) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const organizationId = readApiKeyOrganizationId(verification.key.metadata);

      if (!organizationId) {
        return c.json({ error: "API key is missing organization metadata" }, 401);
      }

      const requestedOrganizationId = c.req
        .header("x-notelab-organization-id")
        ?.trim();

      if (
        requestedOrganizationId &&
        requestedOrganizationId !== organizationId
      ) {
        return c.json(
          {
            error: "Forbidden",
            message:
              "API keys can only access the organization they were created for.",
          },
          403,
        );
      }

      const [apiKeyUser] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, verification.key.referenceId))
        .limit(1);

      if (!apiKeyUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!(await getMembership(organizationId, apiKeyUser.id))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      c.set("user", apiKeyUser);
      c.set("session", {
        activeOrganizationId: organizationId,
        activeTeamId: null,
        createdAt: verification.key.createdAt,
        expiresAt:
          verification.key.expiresAt ??
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100),
        id: `api-key:${verification.key.id}`,
        ipAddress: null,
        token: "",
        updatedAt: verification.key.updatedAt,
        userId: apiKeyUser.id,
        userAgent: null,
      });
      c.set("apiKey", {
        id: verification.key.id,
        organizationId,
        referenceId: verification.key.referenceId,
      });
      c.set("authMethod", "apiKey");

      await next();
      return;
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    c.set("user", session?.user ?? null);
    c.set("session", session?.session ?? null);
    c.set("authMethod", session?.user ? "session" : null);

    await next();
  });
};
