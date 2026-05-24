import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const clientUrl = process.env.CLIENT_URL ?? "http://localhost:1420";
const port = Number(process.env.PORT ?? 3000);

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use(
  "*",
  cors({
    origin: clientUrl,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);

  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.get("/", (c) => {
  return c.json({ ok: true, service: "notelab-server" });
});

app.get("/session", (c) => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user) {
    return c.json({ user: null, session: null }, 401);
  }

  return c.json({ user, session });
});

serve({ fetch: app.fetch, port });

console.info(`Notelab server listening on http://localhost:${port}`);

export default app;
