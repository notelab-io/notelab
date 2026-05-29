import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { getMembership } from "../access";
import { getPrimaryClientOrigin, getRequiredStringEnv, getStringEnv } from "../config";
import { db } from "../db";
import { organizationAiProviderConfig, organizationIntegration } from "../db/schema";
import type { AppBindings } from "../types";

type IntegrationKey =
  | "gmail"
  | "github"
  | "google-calendar"
  | "google-drive"
  | "linear"
  | "slack";

type OAuthState = {
  exp: number;
  integration: IntegrationKey;
  organizationId: string;
  userId: string;
  coworkerCalendarAccessEnabled?: boolean;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string };
  enterprise?: { id?: string; name?: string };
  is_enterprise_install?: boolean;
  authed_user?: { id?: string };
  error?: string;
};

type AiProviderCatalogItem = {
  id: string;
  name: string;
  kind: "workers-ai" | "openai-compatible";
  baseUrl?: string;
  models: Array<{ id: string; name: string }>;
  requiresApiKey: boolean;
};

const integrationKeys = new Set<IntegrationKey>([
  "gmail",
  "github",
  "google-calendar",
  "google-drive",
  "linear",
  "slack",
]);

const googleScopes = {
  gmail: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  "google-calendar": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ],
  "google-calendar-coworkers": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
  "google-drive": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
} as const;

const providerCatalog: AiProviderCatalogItem[] = [
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    kind: "workers-ai",
    requiresApiKey: false,
    models: [
      { id: "@cf/openai/gpt-oss-120b", name: "GPT OSS 120B" },
      { id: "@cf/openai/gpt-oss-20b", name: "GPT OSS 20B" },
      { id: "@cf/moonshotai/kimi-k2.5", name: "Kimi K2.5" },
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B" },
      { id: "@cf/zai-org/glm-4.7-flash", name: "GLM 4.7 Flash" },
    ],
  },
  openAiCompatible("openai", "OpenAI", "https://api.openai.com/v1", [
    ["gpt-5.2", "GPT-5.2"],
    ["gpt-5.2-mini", "GPT-5.2 Mini"],
    ["gpt-4.1", "GPT-4.1"],
  ]),
  openAiCompatible("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", [
    ["openai/gpt-5.2", "GPT-5.2"],
    ["anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5"],
    ["google/gemini-2.5-pro", "Gemini 2.5 Pro"],
  ]),
  openAiCompatible("google-ai-studio", "Google AI Studio", "https://generativelanguage.googleapis.com/v1beta/openai", [
    ["gemini-2.5-pro", "Gemini 2.5 Pro"],
    ["gemini-2.5-flash", "Gemini 2.5 Flash"],
  ]),
  openAiCompatible("custom", "Custom / Community", undefined, [
    ["model-id", "Custom model"],
  ]),
];

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

  return c.json(await getIntegrationStatus(c, integration, auth.organizationId));
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
  const coworkerCalendarAccessEnabled =
    Boolean((body as { coworkerCalendarAccessEnabled?: unknown }).coworkerCalendarAccessEnabled);
  const url = await createOAuthUrl(c, integration, {
    coworkerCalendarAccessEnabled,
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
      return c.redirect(oauthResultUrl(c, integration ?? "gmail", "error", "not_found"));
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

organizationSettingsRoutes.patch("/integrations/google-calendar", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const body = await c.req.json().catch(() => ({}));
  const coworkerCalendarAccessEnabled = Boolean(
    (body as { coworkerCalendarAccessEnabled?: unknown })
      .coworkerCalendarAccessEnabled,
  );
  const connection = await getConnection(auth.organizationId, "google-calendar");

  if (!connection) {
    return c.json({ message: "Google Calendar is not connected." }, 409);
  }

  await db
    .update(organizationIntegration)
    .set({
      metadata: {
        ...readObject(connection.metadata),
        coworkerCalendarAccessEnabled,
      },
      updatedAt: new Date(),
    })
    .where(eq(organizationIntegration.id, connection.id));

  return c.json(await getIntegrationStatus(c, "google-calendar", auth.organizationId));
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

async function requireActiveOrganization(c: Context<AppBindings>) {
  const user = c.get("user");
  const session = c.get("session");
  const organizationId =
    session?.activeOrganizationId ??
    c.req.header("x-notelab-organization-id")?.trim();

  if (!user) {
    return { response: c.json({ error: "Unauthorized" }, 401) };
  }

  if (!organizationId) {
    return { response: c.json({ error: "No active organization" }, 409) };
  }

  if (!(await getMembership(organizationId, user.id))) {
    return { response: c.json({ error: "Forbidden" }, 403) };
  }

  return { organizationId, user };
}

function readIntegration(c: Context<AppBindings>) {
  const value = c.req.param("integration") as IntegrationKey;

  return integrationKeys.has(value) ? value : null;
}

async function getIntegrationStatus(
  c: Context<AppBindings>,
  integration: IntegrationKey,
  organizationId: string,
) {
  const connection = await getConnection(organizationId, integration);
  const configured = hasOAuthConfig(c, integration);

  if (!connection) {
    return {
      connected: false,
      configured,
      coworkerCalendarAccessEnabled:
        integration === "google-calendar" ? false : undefined,
      integration,
    };
  }

  const metadata = readObject(connection.metadata);
  const scopes = splitScopes(connection.scopes);

  return {
    connected: true,
    configured,
    connectedAt: connection.createdAt.toISOString(),
    displayName: connection.displayName,
    email: typeof metadata.email === "string" ? metadata.email : undefined,
    hostedDomain:
      typeof metadata.hostedDomain === "string" ? metadata.hostedDomain : undefined,
    connectedUserEmail:
      typeof metadata.connectedUserEmail === "string"
        ? metadata.connectedUserEmail
        : undefined,
    connectedUserId: metadata.connectedUserId,
    connectedUserLogin:
      typeof metadata.connectedUserLogin === "string"
        ? metadata.connectedUserLogin
        : undefined,
    connectedUserName:
      typeof metadata.connectedUserName === "string"
        ? metadata.connectedUserName
        : undefined,
    coworkerCalendarAccessEnabled:
      integration === "google-calendar"
        ? metadata.coworkerCalendarAccessEnabled === true
        : undefined,
    coworkerCalendarAccessGranted:
      integration === "google-calendar"
        ? scopes.includes("https://www.googleapis.com/auth/calendar.freebusy")
        : undefined,
    enterpriseId:
      typeof metadata.enterpriseId === "string" ? metadata.enterpriseId : undefined,
    enterpriseName:
      typeof metadata.enterpriseName === "string"
        ? metadata.enterpriseName
        : undefined,
    integration,
    isEnterpriseInstall:
      integration === "slack" ? metadata.isEnterpriseInstall === true : undefined,
    organizationId:
      integration === "linear" ? connection.providerAccountId : undefined,
    organizationName:
      integration === "linear" ? connection.displayName ?? undefined : undefined,
    organizationUrlKey:
      typeof metadata.organizationUrlKey === "string"
        ? metadata.organizationUrlKey
        : undefined,
    providerAccountId: connection.providerAccountId,
    scopes,
    status: connection.status,
    teamId: typeof metadata.teamId === "string" ? metadata.teamId : undefined,
    teamName: typeof metadata.teamName === "string" ? metadata.teamName : undefined,
    updatedAt: connection.updatedAt.toISOString(),
  };
}

async function getConnection(organizationId: string, integration: IntegrationKey) {
  const [connection] = await db
    .select()
    .from(organizationIntegration)
    .where(
      and(
        eq(organizationIntegration.organizationId, organizationId),
        eq(organizationIntegration.integrationKey, integration),
      ),
    )
    .limit(1);

  return connection ?? null;
}

async function createOAuthUrl(
  c: Context<AppBindings>,
  integration: IntegrationKey,
  input: {
    coworkerCalendarAccessEnabled: boolean;
    organizationId: string;
    userId: string;
  },
) {
  const state = signState(c, {
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    integration,
    organizationId: input.organizationId,
    userId: input.userId,
    coworkerCalendarAccessEnabled: input.coworkerCalendarAccessEnabled,
  });
  const redirectUri = getCallbackUrl(c, integration);

  if (integration === "github") {
    const clientId = getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID");

    if (!clientId || !getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET")) {
      return oauthConfigError("GITHUB_OAUTH_NOT_CONFIGURED", "GitHub OAuth is not configured.");
    }

    return {
      url: withParams("https://github.com/login/oauth/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "read:user user:email repo",
        state,
      }),
    };
  }

  if (integration === "slack") {
    const clientId = getStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID");

    if (!clientId || !getStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET")) {
      return oauthConfigError("SLACK_OAUTH_NOT_CONFIGURED", "Slack OAuth is not configured.");
    }

    return {
      url: withParams("https://slack.com/oauth/v2/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "channels:history channels:read files:read users:read",
        state,
      }),
    };
  }

  if (integration === "linear") {
    const clientId = getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID");

    if (!clientId || !getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET")) {
      return oauthConfigError("LINEAR_OAUTH_NOT_CONFIGURED", "Linear OAuth is not configured.");
    }

    return {
      url: withParams("https://linear.app/oauth/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "read",
        state,
      }),
    };
  }

  const clientId = getGoogleClientId(c);

  if (!clientId || !getGoogleClientSecret(c)) {
    return oauthConfigError("GOOGLE_OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.");
  }

  const scopes =
    integration === "google-calendar" && input.coworkerCalendarAccessEnabled
      ? googleScopes["google-calendar-coworkers"]
      : googleScopes[integration];

  return {
    url: withParams("https://accounts.google.com/o/oauth2/v2/auth", {
      access_type: "offline",
      client_id: clientId,
      include_granted_scopes: "true",
      prompt: "consent",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
    }),
  };
}

async function handleOAuthCallback(c: Context<AppBindings>, integration: IntegrationKey) {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const rawState = c.req.query("state");

  if (error) {
    return c.redirect(oauthResultUrl(c, integration, "error", error));
  }

  if (!code || !rawState) {
    return c.redirect(oauthResultUrl(c, integration, "error", "missing_oauth_callback"));
  }

  const state = verifyState(c, rawState);

  if (!state || state.integration !== integration) {
    return c.redirect(oauthResultUrl(c, integration, "error", "invalid_oauth_state"));
  }

  try {
    const connection = await exchangeAndBuildConnection(c, integration, code, state);
    const now = new Date();
    const existing = await getConnection(state.organizationId, integration);

    if (existing) {
      await db
        .update(organizationIntegration)
        .set({ ...connection, connectedById: state.userId, updatedAt: now })
        .where(eq(organizationIntegration.id, existing.id));
    } else {
      await db.insert(organizationIntegration).values({
        id: crypto.randomUUID(),
        organizationId: state.organizationId,
        connectedById: state.userId,
        integrationKey: integration,
        createdAt: now,
        updatedAt: now,
        ...connection,
      });
    }

    return c.redirect(oauthResultUrl(c, integration, "success", "connected"));
  } catch (exchangeError) {
    console.error("OAuth callback failed", integration, exchangeError);

    return c.redirect(oauthResultUrl(c, integration, "error", "oauth_callback_failed"));
  }
}

async function exchangeAndBuildConnection(
  c: Context<AppBindings>,
  integration: IntegrationKey,
  code: string,
  state: OAuthState,
) {
  if (integration === "github") {
    const token = await postForm<TokenResponse>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: getRequiredStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID"),
        client_secret: getRequiredStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET"),
        code,
        redirect_uri: getCallbackUrl(c, integration),
      },
      { Accept: "application/json" },
    );

    assertAccessToken(token);

    const profile = await fetchJson<{
      email?: string | null;
      id: number;
      login: string;
      name?: string | null;
    }>("https://api.github.com/user", token.access_token!);

    return {
      accessToken: token.access_token!,
      displayName: profile.name || profile.login,
      expiresAt: null,
      metadata: {
        connectedUserEmail: profile.email,
        connectedUserId: profile.id,
        connectedUserLogin: profile.login,
        connectedUserName: profile.name,
        tokenType: token.token_type,
      },
      providerAccountId: String(profile.id),
      refreshToken: token.refresh_token ?? null,
      scopes: token.scope ?? "read:user user:email repo",
      status: "connected",
      tokenType: token.token_type ?? "bearer",
    };
  }

  if (integration === "slack") {
    const token = await postForm<TokenResponse>("https://slack.com/api/oauth.v2.access", {
      client_id: getRequiredStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID"),
      client_secret: getRequiredStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: getCallbackUrl(c, integration),
    });

    assertAccessToken(token);

    return {
      accessToken: token.access_token!,
      displayName: token.team?.name ?? token.enterprise?.name ?? "Slack",
      expiresAt: null,
      metadata: {
        appId: token.app_id,
        botUserId: token.bot_user_id,
        enterpriseId: token.enterprise?.id,
        enterpriseName: token.enterprise?.name,
        isEnterpriseInstall: token.is_enterprise_install,
        teamId: token.team?.id,
        teamName: token.team?.name,
        tokenType: token.token_type,
      },
      providerAccountId: token.team?.id ?? token.enterprise?.id ?? "slack",
      refreshToken: token.refresh_token ?? null,
      scopes: token.scope ?? "channels:history channels:read files:read users:read",
      status: "connected",
      tokenType: token.token_type ?? "bot",
    };
  }

  if (integration === "linear") {
    const token = await postForm<TokenResponse>("https://api.linear.app/oauth/token", {
      client_id: getRequiredStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID"),
      client_secret: getRequiredStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: getCallbackUrl(c, integration),
    });

    assertAccessToken(token);

    const viewer = await fetchLinearViewer(token.access_token!);

    return {
      accessToken: token.access_token!,
      displayName: viewer.organization.name,
      expiresAt: null,
      metadata: {
        connectedUserEmail: viewer.email,
        connectedUserId: viewer.id,
        connectedUserName: viewer.name,
        organizationUrlKey: viewer.organization.urlKey,
      },
      providerAccountId: viewer.organization.id,
      refreshToken: token.refresh_token ?? null,
      scopes: token.scope ?? "read",
      status: "connected",
      tokenType: token.token_type ?? "bearer",
    };
  }

  const token = await postForm<TokenResponse>("https://oauth2.googleapis.com/token", {
    client_id: getRequiredGoogleClientId(c),
    client_secret: getRequiredGoogleClientSecret(c),
    code,
    grant_type: "authorization_code",
    redirect_uri: getCallbackUrl(c, integration),
  });

  assertAccessToken(token);

  const claims = decodeJwt(token.id_token);
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const hostedDomain = typeof claims.hd === "string" ? claims.hd : undefined;
  const providerAccountId =
    typeof claims.sub === "string" ? claims.sub : email ?? integration;

  return {
    accessToken: token.access_token!,
    displayName: email ?? integration,
    expiresAt: token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null,
    metadata: {
      coworkerCalendarAccessEnabled:
        integration === "google-calendar"
          ? state.coworkerCalendarAccessEnabled === true
          : undefined,
      email,
      hostedDomain,
    },
    providerAccountId,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? googleScopes[integration].join(" "),
    status: "connected",
    tokenType: token.token_type ?? "bearer",
  };
}

function getCallbackUrl(c: Context<AppBindings>, integration: IntegrationKey) {
  const url = new URL(c.req.url);

  return `${url.origin}/api/organization/settings/integrations/${integration}/callback`;
}

function oauthResultUrl(
  c: Context<AppBindings>,
  integration: IntegrationKey,
  result: "error" | "success",
  code: string,
) {
  const paramName =
    integration === "google-calendar"
      ? "googleCalendar"
      : integration === "google-drive"
        ? "googleDrive"
        : integration;
  const url = new URL("/settings/integrations", getPrimaryClientOrigin(c.env));

  url.searchParams.set(paramName, result);
  url.searchParams.set("code", code);

  return url.toString();
}

function signState(c: Context<AppBindings>, payload: OAuthState) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getStateSecret(c))
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyState(c: Context<AppBindings>, rawState: string): OAuthState | null {
  const [encoded, signature] = rawState.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getStateSecret(c))
    .update(encoded)
    .digest("base64url");
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    givenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(givenBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;

    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function getStateSecret(c: Context<AppBindings>) {
  return getRequiredStringEnv(c.env, "OAUTH_STATE_SECRET");
}

function hasOAuthConfig(c: Context<AppBindings>, integration: IntegrationKey) {
  if (integration === "github") {
    return Boolean(
      getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID") &&
        getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET"),
    );
  }

  if (integration === "slack") {
    return Boolean(
      getStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID") &&
        getStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET"),
    );
  }

  if (integration === "linear") {
    return Boolean(
      getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID") &&
        getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET"),
    );
  }

  return Boolean(getGoogleClientId(c) && getGoogleClientSecret(c));
}

function getGoogleClientId(c: Context<AppBindings>) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getGoogleClientSecret(c: Context<AppBindings>) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_SECRET");
}

function getRequiredGoogleClientId(c: Context<AppBindings>) {
  return getRequiredStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getRequiredGoogleClientSecret(c: Context<AppBindings>) {
  return getRequiredStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_SECRET");
}

function oauthConfigError(code: string, message: string) {
  return { code, error: true as const, message };
}

function withParams(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function postForm<T>(
  url: string,
  body: Record<string, string>,
  headers?: Record<string, string>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(body),
  });
  const data = (await response.json()) as T;

  if (!response.ok || (data as TokenResponse).error) {
    throw new Error((data as TokenResponse).error ?? "OAuth token exchange failed");
  }

  return data;
}

async function fetchJson<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "notelab-server",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchLinearViewer(accessToken: string) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query:
        "query Viewer { viewer { id name email organization { id name urlKey } } }",
    }),
  });
  const body = (await response.json()) as {
    data?: {
      viewer?: {
        email?: string;
        id: string;
        name?: string;
        organization: { id: string; name: string; urlKey?: string };
      };
    };
  };

  if (!response.ok || !body.data?.viewer) {
    throw new Error("Could not read Linear viewer.");
  }

  return body.data.viewer;
}

function assertAccessToken(token: TokenResponse) {
  if (!token.access_token) {
    throw new Error("OAuth provider did not return an access token.");
  }
}

function decodeJwt(token: string | undefined) {
  if (!token) {
    return {};
  }

  const payload = token.split(".")[1];

  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function splitScopes(scopes: string | null) {
  return scopes?.split(/\s+/).filter(Boolean) ?? [];
}

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function openAiCompatible(
  id: string,
  name: string,
  baseUrl: string | undefined,
  models: Array<[string, string]>,
): AiProviderCatalogItem {
  return {
    id,
    name,
    kind: "openai-compatible",
    baseUrl,
    requiresApiKey: true,
    models: models.map(([modelId, modelName]) => ({ id: modelId, name: modelName })),
  };
}

async function listAiProviderConfigs(organizationId: string) {
  const rows = await db
    .select()
    .from(organizationAiProviderConfig)
    .where(eq(organizationAiProviderConfig.organizationId, organizationId));
  const byProvider = new Map(rows.map((row) => [row.providerId, row]));

  return providerCatalog.map((provider) => {
    const row = byProvider.get(provider.id);

    return {
      apiKeyConfigured: Boolean(row?.apiKey),
      baseUrl: row?.baseUrl ?? provider.baseUrl ?? "",
      enabled:
        row?.enabled ??
        (provider.id === "cloudflare-workers-ai" && isCloudflareWorkersAiAvailable()),
      modelIds: Array.isArray(row?.modelIds)
        ? row.modelIds
        : provider.models.map((model) => model.id),
      provider,
      providerId: provider.id,
      updatedAt: row?.updatedAt?.toISOString(),
    };
  });
}

function isCloudflareWorkersAiAvailable() {
  return true;
}

async function getAiProviderConfig(organizationId: string, providerId: string) {
  const [row] = await db
    .select()
    .from(organizationAiProviderConfig)
    .where(
      and(
        eq(organizationAiProviderConfig.organizationId, organizationId),
        eq(organizationAiProviderConfig.providerId, providerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

function getCatalogItem(providerId: string) {
  const provider = providerCatalog.find((item) => item.id === providerId);

  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerId}`);
  }

  return provider;
}
