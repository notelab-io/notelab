import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";

import { getMembership, isPrivilegedOrgRole } from "../../access";
import { getRequiredStringEnv, getStringEnv } from "../../config";
import { db } from "../../db";
import { organizationIntegration, user, userIntegration } from "../../db/schema";
import type { AppBindings } from "../../types";
import {
  assertAccessToken,
  getCallbackUrl,
  oauthConfigError,
  postForm,
  signState,
  withParams,
} from "./oauth-utils";
import {
  emailsMatch,
  getConnection,
  getUserConnection,
  getUserRecord,
  readIntegrationMode,
  readObject,
  requireActiveOrganization,
} from "./shared";
import {
  OAuthCallbackError,
  type OAuthState,
  type OrganizationSettingsContext,
  type TokenResponse,
} from "./types";

type SlackConnection = Awaited<ReturnType<typeof exchangeSlackConnection>>;

export function createSlackOAuthUrl(
  c: OrganizationSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "workspace";
    organizationId: string;
    userId: string;
  },
) {
  const clientId = getStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID");

  if (!clientId || !getStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET")) {
    return oauthConfigError("SLACK_OAUTH_NOT_CONFIGURED", "Slack OAuth is not configured.");
  }

  return {
    url: withParams("https://slack.com/oauth/v2/authorize", {
      client_id: clientId,
      redirect_uri: getCallbackUrl(c, "slack"),
      scope: "channels:history channels:read files:read users:read users:read.email",
      state: signState(c, {
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
        enforceEmailMatch: input.enforceEmailMatch,
        integration: "slack",
        mode: input.mode,
        organizationId: input.organizationId,
        userId: input.userId,
      }),
      user_scope: "identity.basic identity.email users:read users:read.email",
    }),
  };
}

export function hasSlackOAuthConfig(c: OrganizationSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleSlackOAuthCallback(
  c: OrganizationSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "workspace";
  const connection = await exchangeSlackConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "workspace") {
    const membership = await getMembership(state.organizationId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only organization admins can connect Slack.",
      );
    }

    if (
      state.enforceEmailMatch === true &&
      !emailsMatch(connection.email, userRecord.email)
    ) {
      throw new OAuthCallbackError(
        "email_mismatch",
        "Slack email does not match Notelab email.",
      );
    }

    await upsertSlackWorkspaceConnection(state, connection);
    await upsertSlackUserConnection(state, connection);
    return;
  }

  const workspaceConnection = await getConnection(state.organizationId, "slack");

  if (!workspaceConnection) {
    throw new OAuthCallbackError(
      "slack_workspace_not_connected",
      "Slack workspace is not connected.",
    );
  }

  if (workspaceConnection.providerAccountId !== connection.organizationId) {
    throw new OAuthCallbackError(
      "slack_workspace_mismatch",
      "Slack account belongs to a different workspace.",
    );
  }

  if (
    readObject(workspaceConnection.metadata).enforceEmailMatch === true &&
    !emailsMatch(connection.email, userRecord.email)
  ) {
    throw new OAuthCallbackError(
      "email_mismatch",
      "Slack email does not match Notelab email.",
    );
  }

  await upsertSlackUserConnection(state, connection);
}

export async function getSlackIntegrationStatus(
  c: OrganizationSettingsContext,
  organizationId: string,
  userId: string,
  workspaceConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    organizationId,
    userId,
    "slack",
  );
  const workspaceMetadata = readObject(workspaceConnection?.metadata);

  return {
    configured: hasSlackOAuthConfig(c),
    connected: workspaceConnection?.status === "connected",
    integration: "slack",
    personal: {
      connected: personalConnection?.status === "connected",
      connectedAt: personalConnection?.createdAt.toISOString(),
      email: personalConnection?.email ?? undefined,
      name: personalConnection?.displayName ?? undefined,
      providerAccountId: personalConnection?.providerAccountId,
      providerOrganizationId:
        personalConnection?.providerOrganizationId ?? undefined,
      updatedAt: personalConnection?.updatedAt.toISOString(),
    },
    workspace: {
      connected: workspaceConnection?.status === "connected",
      connectedAt: workspaceConnection?.createdAt.toISOString(),
      enforceEmailMatch: workspaceMetadata.enforceEmailMatch === true,
      organizationId: workspaceConnection?.providerAccountId,
      organizationName: workspaceConnection?.displayName ?? undefined,
      enterpriseId:
        typeof workspaceMetadata.enterpriseId === "string"
          ? workspaceMetadata.enterpriseId
          : undefined,
      enterpriseName:
        typeof workspaceMetadata.enterpriseName === "string"
          ? workspaceMetadata.enterpriseName
          : undefined,
      isEnterpriseInstall: workspaceMetadata.isEnterpriseInstall === true,
      teamId:
        typeof workspaceMetadata.teamId === "string"
          ? workspaceMetadata.teamId
          : undefined,
      teamName:
        typeof workspaceMetadata.teamName === "string"
          ? workspaceMetadata.teamName
          : undefined,
      updatedAt: workspaceConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateSlackIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only organization admins can manage Slack settings." },
      403,
    );
  }

  const connection = await getConnection(auth.organizationId, "slack");

  if (!connection) {
    return c.json({ message: "Slack workspace is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeSlackEmailMismatches(auth.organizationId)
      : 0;

  await db
    .update(organizationIntegration)
    .set({
      metadata: {
        ...metadata,
        enforceEmailMatch,
      },
      updatedAt: new Date(),
    })
    .where(eq(organizationIntegration.id, connection.id));
  const updatedConnection =
    (await getConnection(auth.organizationId, "slack")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getSlackIntegrationStatus(
      c,
      auth.organizationId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectSlackIntegration(
  c: Context<AppBindings>,
  auth: {
    organizationId: string;
    user: { id: string };
    membership: { role: string };
  },
) {
  const body = await c.req.json().catch(() => ({}));
  const mode = readIntegrationMode(body);

  if (mode === "workspace") {
    if (!isPrivilegedOrgRole(auth.membership.role)) {
      return c.json(
        { message: "Only organization admins can disconnect the Slack workspace." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(organizationIntegration)
        .where(
          and(
            eq(organizationIntegration.organizationId, auth.organizationId),
            eq(organizationIntegration.integrationKey, "slack"),
          ),
        )
        .returning({ id: organizationIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.organizationId, auth.organizationId),
            eq(userIntegration.integrationKey, "slack"),
          ),
        ),
    ]);

    return c.json({ connected: false, deleted: deleted.length > 0 });
  }

  const deleted = await db
    .delete(userIntegration)
    .where(
      and(
        eq(userIntegration.organizationId, auth.organizationId),
        eq(userIntegration.userId, auth.user.id),
        eq(userIntegration.integrationKey, "slack"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeSlackConnection(
  c: OrganizationSettingsContext,
  code: string,
) {
  const token = await postForm<TokenResponse>("https://slack.com/api/oauth.v2.access", {
    client_id: getRequiredStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID"),
    client_secret: getRequiredStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET"),
    code,
    redirect_uri: getCallbackUrl(c, "slack"),
  });

  assertAccessToken(token);

  const authedUserId = token.authed_user?.id;
  const authedUser = authedUserId
    ? await fetchSlackUser(token.access_token!, authedUserId)
    : null;
  const workspaceId = token.enterprise?.id ?? token.team?.id ?? "slack";
  const workspaceName = token.enterprise?.name ?? token.team?.name ?? "Slack";

  return {
    accessToken: token.access_token!,
    appId: token.app_id,
    botUserId: token.bot_user_id,
    email: authedUser?.profile?.email,
    enterpriseId: token.enterprise?.id,
    enterpriseName: token.enterprise?.name,
    isEnterpriseInstall: token.is_enterprise_install,
    name: authedUser?.profile?.real_name || authedUser?.name,
    organizationId: workspaceId,
    organizationName: workspaceName,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "channels:history channels:read files:read users:read users:read.email",
    teamId: token.team?.id,
    teamName: token.team?.name,
    tokenType: token.token_type ?? "bot",
    userAccessToken: token.authed_user?.access_token,
    userId: authedUserId ?? token.bot_user_id ?? workspaceId,
    userRefreshToken: token.authed_user?.refresh_token,
    userScopes: token.authed_user?.scope,
    userTokenType: token.authed_user?.token_type,
  };
}

async function upsertSlackWorkspaceConnection(
  state: OAuthState,
  connection: SlackConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.organizationId, "slack");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.organizationName,
    expiresAt: null,
    metadata: {
      appId: connection.appId,
      botUserId: connection.botUserId,
      enforceEmailMatch: state.enforceEmailMatch === true,
      enterpriseId: connection.enterpriseId,
      enterpriseName: connection.enterpriseName,
      isEnterpriseInstall: connection.isEnterpriseInstall,
      teamId: connection.teamId,
      teamName: connection.teamName,
    },
    providerAccountId: connection.organizationId,
    refreshToken: connection.refreshToken,
    scopes: connection.scopes,
    status: "connected",
    tokenType: connection.tokenType,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(organizationIntegration)
      .set(values)
      .where(eq(organizationIntegration.id, existing.id));
    return;
  }

  await db.insert(organizationIntegration).values({
    id: crypto.randomUUID(),
    organizationId: state.organizationId,
    integrationKey: "slack",
    createdAt: now,
    ...values,
  });
}

async function upsertSlackUserConnection(
  state: OAuthState,
  connection: SlackConnection,
) {
  const now = new Date();
  const existing = await getUserConnection(
    state.organizationId,
    state.userId,
    "slack",
  );
  const values = {
    accessToken: connection.userAccessToken ?? connection.accessToken,
    displayName: connection.name ?? connection.email ?? "Slack user",
    email: connection.email ?? null,
    expiresAt: null,
    metadata: {
      enterpriseId: connection.enterpriseId,
      enterpriseName: connection.enterpriseName,
      organizationName: connection.organizationName,
      teamId: connection.teamId,
      teamName: connection.teamName,
    },
    providerAccountId: connection.userId,
    providerOrganizationId: connection.organizationId,
    refreshToken: connection.userRefreshToken ?? connection.refreshToken,
    scopes: connection.userScopes ?? connection.scopes,
    status: "connected",
    tokenType: connection.userTokenType ?? connection.tokenType,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(userIntegration)
      .set(values)
      .where(eq(userIntegration.id, existing.id));
    return;
  }

  await db.insert(userIntegration).values({
    id: crypto.randomUUID(),
    organizationId: state.organizationId,
    userId: state.userId,
    integrationKey: "slack",
    createdAt: now,
    ...values,
  });
}

async function removeSlackEmailMismatches(organizationId: string) {
  const rows = await db
    .select({
      id: userIntegration.id,
      integrationEmail: userIntegration.email,
      notelabEmail: user.email,
    })
    .from(userIntegration)
    .innerJoin(user, eq(userIntegration.userId, user.id))
    .where(
      and(
        eq(userIntegration.organizationId, organizationId),
        eq(userIntegration.integrationKey, "slack"),
      ),
    );
  const mismatchedIds = rows
    .filter((row) => !emailsMatch(row.integrationEmail, row.notelabEmail))
    .map((row) => row.id);

  if (mismatchedIds.length === 0) {
    return 0;
  }

  const removed = await db
    .delete(userIntegration)
    .where(inArray(userIntegration.id, mismatchedIds))
    .returning({ id: userIntegration.id });

  return removed.length;
}

async function fetchSlackUser(accessToken: string, userId: string) {
  const url = new URL("https://slack.com/api/users.info");

  url.searchParams.set("user", userId);

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    user?: {
      id: string;
      name?: string;
      profile?: {
        email?: string;
        real_name?: string;
      };
    };
  };

  if (!response.ok || body.ok === false || !body.user) {
    throw new Error(body.error ?? "Could not read Slack user.");
  }

  return body.user;
}
