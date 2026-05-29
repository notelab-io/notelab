import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";
import { createDbClient, runWithDbClient } from "../db";
import type { AppBindings } from "../types";

export const sessionMiddleware: MiddlewareHandler<AppBindings> = async (
  c,
  next,
) => {
  const dbClient = createDbClient(c.env);

  await runWithDbClient(dbClient, async () => {
    const auth = createAuth(c.env, c.req.raw);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    c.set("user", session?.user ?? null);
    c.set("session", session?.session ?? null);

    await next();
  });
};
