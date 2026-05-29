import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { clientOrigins, port } from "./config";
import { sessionMiddleware } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { databaseRoutes } from "./routes/databases";
import { healthRoutes } from "./routes/health";
import { metadataRoutes } from "./routes/metadata";
import { organizationRoutes } from "./routes/organizations";
import { sessionRoutes } from "./routes/session";
import { userSettingsRoutes } from "./routes/user-settings";
import { workspaceRoutes } from "./routes/workspaces";
import type { AppBindings } from "./types";

const app = new Hono<AppBindings>();

app.use(
  "*",
  cors({
    origin: clientOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use("*", sessionMiddleware);

app.route("/", authRoutes);
app.route("/databases", databaseRoutes);
app.route("/", healthRoutes);
app.route("/metadata", metadataRoutes);
app.route("/organizations", organizationRoutes);
app.route("/session", sessionRoutes);
app.route("/user-settings", userSettingsRoutes);
app.route("/workspaces", workspaceRoutes);

serve({ fetch: app.fetch, port });

console.info(`Notelab server listening on http://localhost:${port}`);

export default app;
