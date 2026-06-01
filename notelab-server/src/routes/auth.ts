import { Hono } from "hono";
import { createAuth } from "../auth";
import { createDbClient, runWithDbClient } from "../db";
import type { AppBindings } from "../types";

export const authRoutes = new Hono<AppBindings>();

authRoutes.on(["GET", "POST"], "/api/auth/*", (c) => {
  if (c.req.path.startsWith("/api/auth/api-key/")) {
    return c.json({ error: "Not found" }, 404);
  }

  const dbClient = createDbClient(c.env);

  return runWithDbClient(dbClient, () => {
    const auth = createAuth(c.env, c.req.raw);

    return auth.handler(c.req.raw);
  });
});
