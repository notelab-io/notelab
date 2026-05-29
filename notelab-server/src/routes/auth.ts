import { Hono } from "hono";
import { createAuth } from "../auth";
import { createDbClient, runWithDbClient } from "../db";
import type { AppBindings } from "../types";

export const authRoutes = new Hono<AppBindings>();

authRoutes.on(["GET", "POST"], "/api/auth/*", (c) => {
  const dbClient = createDbClient(c.env);

  return runWithDbClient(dbClient, () => {
    const auth = createAuth(c.env, c.req.raw);

    return auth.handler(c.req.raw);
  });
});
