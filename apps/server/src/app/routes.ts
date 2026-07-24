import type { Hono } from "hono";

import { aiRoutes, aiThreadRoutes } from "../features/ai/routes";
import {
  apiKeyRoutes,
  authRoutes,
  pageSettingsRoutes,
  sessionRoutes,
} from "../features/auth/routes";
import { databaseRoutes } from "../features/databases/routes";
import { getEEAdminRoutes } from "../edition";
import { healthRoutes } from "../features/health/routes";
import { licenseRoutes } from "../routes/license";
import { imageRoutes } from "../features/images/routes";
import { metadataRoutes } from "../features/metadata/routes";
import { pageRoutes } from "../features/pages/routes";
import { pageLayoutRoutes } from "../features/page-layouts/routes";
import { searchRoutes } from "../features/search/routes";
import {
  workspaceRoutes,
  workspaceSettingsRoutes,
} from "../features/workspaces/routes";
import type { AppBindings } from "../types";

export function registerRoutes(app: Hono<AppBindings>) {
  app.route("/api/ai", aiRoutes);
  app.route("/api/ai", aiThreadRoutes);
  app.route("/api/keys", apiKeyRoutes);
  app.route("/", authRoutes);
  app.route("/databases", databaseRoutes);
  app.route("/", healthRoutes);
  app.route("/api/license", licenseRoutes);
  app.route("/images", imageRoutes);
  app.route("/metadata", metadataRoutes);
  app.route("/workspaces", workspaceRoutes);
  app.route("/api/workspace/settings", workspaceSettingsRoutes);
  app.route("/search", searchRoutes);
  app.route("/session", sessionRoutes);
  app.route("/user-settings", pageSettingsRoutes);
  app.route("/pages", pageRoutes);
  app.route("/page-layouts", pageLayoutRoutes);

  // Commercial edition only: Teams/Enterprise admin APIs. Empty in Community
  // (getEEAdminRoutes() is null). Call createApp() after initEdition().
  const eeAdmin = getEEAdminRoutes();
  if (eeAdmin) {
    app.route("/api/admin", eeAdmin);
  }
}
