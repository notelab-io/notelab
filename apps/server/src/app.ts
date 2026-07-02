import { Hono } from "hono";
import { cors } from "hono/cors";

import { isAllowedClientOrigin, isLocalDevelopmentHost } from "./config";
import { sessionMiddleware } from "./middleware/session";
import { aiRoutes } from "./routes/ai";
import { aiThreadRoutes } from "./routes/ai-threads";
import { apiKeyRoutes } from "./routes/api-keys";
import { authRoutes } from "./routes/auth";
import { commentRoutes } from "./routes/comments";
import { databaseRoutes } from "./routes/databases";
import { healthRoutes } from "./routes/health";
import { imageRoutes } from "./routes/images";
import { metadataRoutes } from "./routes/metadata";
import { workspaceSettingsRoutes } from "./routes/workspace-settings";
import { workspaceRoutes } from "./routes/workspaces";
import { searchRoutes } from "./routes/search";
import { sessionRoutes } from "./routes/session";
import { pageSettingsRoutes } from "./routes/user-settings";
import { pageRoutes } from "./routes/pages";
import type { AppBindings } from "./types";

export function createApp() {
  const app = new Hono<AppBindings>();

  app.use(
    "*",
    cors({
      origin: (origin, c) => {
        const requestUrl = new URL(c.req.url);

        if (isLocalDevelopmentHost(requestUrl.hostname)) {
          return origin ?? null;
        }

        return isAllowedClientOrigin(c.env, origin) ? origin : null;
      },
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-api-key",
        "x-mobile-auth-cookie",
        "x-notelab-workspace-id",
        "Content-Length",
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("*", async (c, next) => {
    if (c.req.path === "/" || c.req.path.startsWith("/api/auth/")) {
      await next();
      return;
    }

    return await sessionMiddleware(c, next);
  });

  app.route("/api/ai", aiRoutes);
  app.route("/api/ai", aiThreadRoutes);
  app.route("/api/keys", apiKeyRoutes);
  app.route("/", authRoutes);
  app.route("/databases", databaseRoutes);
  app.route("/", healthRoutes);
  app.route("/images", imageRoutes);
  app.route("/metadata", metadataRoutes);
  app.route("/workspaces", workspaceRoutes);
  app.route("/api/workspace/settings", workspaceSettingsRoutes);
  app.route("/", commentRoutes);
  app.route("/search", searchRoutes);
  app.route("/session", sessionRoutes);
  app.route("/user-settings", pageSettingsRoutes);
  app.route("/pages", pageRoutes);

  return app;
}
