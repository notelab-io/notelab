import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { isPrivilegedOrgRole } from "../../access";
import { db } from "../../db";
import {
  organizationAiProviderConfig,
  organizationIntegration,
} from "../../db/schema";
import type { AppBindings } from "../../types";
import {
  getAiProviderConfig,
  getCatalogItem,
  listAiProviderConfigs,
  providerCatalog,
} from "./ai-providers";
import {
  disconnectGmailIntegration,
  updateGmailIntegrationSettings,
} from "./gmail";
import {
  disconnectGithubIntegration,
  updateGithubIntegrationSettings,
} from "./github";
import {
  disconnectGoogleCalendarIntegration,
  updateGoogleCalendarIntegrationSettings,
} from "./google-calendar";
import {
  disconnectGoogleDriveIntegration,
  updateGoogleDriveIntegrationSettings,
} from "./google-drive";
import { getIntegrationStatus } from "./integration-status";
import {
  disconnectLinearIntegration,
  updateLinearIntegrationSettings,
} from "./linear";
import {
  createOAuthUrl,
  handleOAuthCallback,
  oauthResultUrl,
} from "./oauth";
import {
  getConnection,
  readIntegrationMode,
  readIntegration,
  requireActiveOrganization,
} from "./shared";
import {
  disconnectSlackIntegration,
  updateSlackIntegrationSettings,
} from "./slack";

export const organizationSettingsRoutes = new Hono<AppBindings>();

organizationSettingsRoutes.get("/integrations/:integration", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const integration = readIntegration(c);

  if (!integration) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(
    await getIntegrationStatus(c, integration, auth.organizationId, auth.user.id),
  );
});

organizationSettingsRoutes.post("/integrations/:integration/start", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const integration = readIntegration(c);

  if (!integration) {
    return c.json({ error: "Not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const mode = readIntegrationMode(body);

  if (
    integration === "github" ||
    integration === "gmail" ||
    integration === "google-calendar" ||
    integration === "google-drive" ||
    integration === "linear" ||
    integration === "slack"
  ) {
    const name =
      integration === "github"
        ? "GitHub"
        : integration === "gmail"
          ? "Gmail"
          : integration === "google-calendar"
            ? "Google Calendar"
            : integration === "google-drive"
              ? "Google Drive"
              : integration === "linear"
                ? "Linear"
                : "Slack";

    if (mode === "workspace" && !isPrivilegedOrgRole(auth.membership.role)) {
      return c.json(
        { message: `Only organization admins can connect the ${name} workspace.` },
        403,
      );
    }

    if (
      mode === "personal" &&
      !(await getConnection(auth.organizationId, integration))
    ) {
      return c.json(
        {
          code: `${integration.toUpperCase().replace("-", "_")}_WORKSPACE_NOT_CONNECTED`,
          message: `Ask an admin to connect the ${name} workspace first.`,
        },
        409,
      );
    }
  }

  const url = await createOAuthUrl(c, integration, {
    coworkerCalendarAccessEnabled: Boolean(
      (body as { coworkerCalendarAccessEnabled?: unknown })
        .coworkerCalendarAccessEnabled,
    ),
    enforceEmailMatch: Boolean(
      (body as { enforceEmailMatch?: unknown }).enforceEmailMatch,
    ),
    mode,
    organizationId: auth.organizationId,
    userId: auth.user.id,
  });

  if ("error" in url) {
    return c.json({ code: url.code, message: url.message }, 409);
  }

  return c.json({ url: url.url });
});

organizationSettingsRoutes.get(
  "/integrations/:integration/callback",
  async (c) => {
    const integration = readIntegration(c);

    if (!integration) {
      return c.redirect(
        oauthResultUrl(c, integration ?? "gmail", "error", "not_found"),
      );
    }

    return handleOAuthCallback(c, integration);
  },
);

organizationSettingsRoutes.post(
  "/integrations/:integration/disconnect",
  async (c) => {
    const auth = await requireActiveOrganization(c);

    if ("response" in auth) {
      return auth.response;
    }

    const integration = readIntegration(c);

    if (!integration) {
      return c.json({ error: "Not found" }, 404);
    }

    if (integration === "github") {
      return disconnectGithubIntegration(c, auth);
    }

    if (integration === "gmail") {
      return disconnectGmailIntegration(c, auth);
    }

    if (integration === "google-drive") {
      return disconnectGoogleDriveIntegration(c, auth);
    }

    if (integration === "google-calendar") {
      return disconnectGoogleCalendarIntegration(c, auth);
    }

    if (integration === "linear") {
      return disconnectLinearIntegration(c, auth);
    }

    if (integration === "slack") {
      return disconnectSlackIntegration(c, auth);
    }

    const deleted = await db
      .delete(organizationIntegration)
      .where(
        and(
          eq(organizationIntegration.organizationId, auth.organizationId),
          eq(organizationIntegration.integrationKey, integration),
        ),
      )
      .returning({ id: organizationIntegration.id });

    return c.json({ connected: false, deleted: deleted.length > 0 });
  },
);

organizationSettingsRoutes.patch("/integrations/linear/settings", async (c) => {
  return updateLinearIntegrationSettings(c);
});

organizationSettingsRoutes.patch("/integrations/gmail/settings", async (c) => {
  return updateGmailIntegrationSettings(c);
});

organizationSettingsRoutes.patch("/integrations/github/settings", async (c) => {
  return updateGithubIntegrationSettings(c);
});

organizationSettingsRoutes.patch("/integrations/google-drive/settings", async (c) => {
  return updateGoogleDriveIntegrationSettings(c);
});

organizationSettingsRoutes.patch("/integrations/google-calendar/settings", async (c) => {
  return updateGoogleCalendarIntegrationSettings(c);
});

organizationSettingsRoutes.patch("/integrations/slack/settings", async (c) => {
  return updateSlackIntegrationSettings(c);
});

organizationSettingsRoutes.get("/ai", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  return c.json({ providers: await listAiProviderConfigs(auth.organizationId) });
});

organizationSettingsRoutes.get("/ai/models", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const providers = await listAiProviderConfigs(auth.organizationId);

  return c.json({
    models: providers.flatMap((config) => {
      const provider = getCatalogItem(config.providerId);

      if (!config.enabled || (provider.requiresApiKey && !config.apiKeyConfigured)) {
        return [];
      }

      const modelIds = config.modelIds.length
        ? config.modelIds
        : provider.models.map((model) => model.id);

      return modelIds.map((modelId) => ({
        chef: provider.name,
        chefSlug: provider.id,
        gatewayId: `${provider.id}:${modelId}`,
        id: `${provider.id}:${modelId}`,
        name: provider.models.find((model) => model.id === modelId)?.name ?? modelId,
        providers: [provider.id],
      }));
    }),
  });
});

organizationSettingsRoutes.put("/ai/providers/:providerId", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const providerId = c.req.param("providerId");
  const provider = providerCatalog.find((item) => item.id === providerId);

  if (!provider) {
    return c.json({ message: "Unknown AI provider." }, 404);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    apiKey?: string;
    baseUrl?: string;
    enabled?: boolean;
    modelIds?: string[];
  };
  const now = new Date();
  const existing = await getAiProviderConfig(auth.organizationId, providerId);
  const values = {
    apiKey:
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : existing?.apiKey ?? null,
    baseUrl:
      typeof body.baseUrl === "string" ? body.baseUrl.trim() : provider.baseUrl ?? "",
    enabled: Boolean(body.enabled),
    modelIds: Array.isArray(body.modelIds) ? body.modelIds : provider.models.map((model) => model.id),
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(organizationAiProviderConfig)
      .set(values)
      .where(eq(organizationAiProviderConfig.id, existing.id));
  } else {
    await db.insert(organizationAiProviderConfig).values({
      id: crypto.randomUUID(),
      organizationId: auth.organizationId,
      providerId,
      createdAt: now,
      ...values,
    });
  }

  return c.json({ providers: await listAiProviderConfigs(auth.organizationId) });
});
