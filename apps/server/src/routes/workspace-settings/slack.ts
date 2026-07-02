import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";

import { getMembership, isPrivilegedOrgRole } from "../../access";
import { getRequiredStringEnv, getStringEnv } from "../../config";
import { db } from "../../db";
import { workspaceIntegration, user, userIntegration } from "../../db/schema";
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
  requireActiveWorkspace,
} from "./shared";
import {
  OAuthCallbackError,
  type OAuthState,
  type WorkspaceSettingsContext,
  type TokenResponse,
} from "./types";

type SlackConnection = Awaited<ReturnType<typeof exchangeSlackConnection>>;

export function createSlackOAuthUrl(
  c: WorkspaceSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "page";
    workspaceId: string;
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
        workspaceId: input.workspaceId,
        userId: input.userId,
      }),
      user_scope: "identity.basic identity.email users:read users:read.email",
    }),
  };
}

export function hasSlackOAuthConfig(c: WorkspaceSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "SLACK_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "SLACK_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleSlackOAuthCallback(
  c: WorkspaceSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "page";
  const connection = await exchangeSlackConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "page") {
    const membership = await getMembership(state.workspaceId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only workspace admins can connect Slack.",
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

    await upsertSlackPageConnection(state, connection);
    await upsertSlackUserConnection(state, connection);
    return;
  }

  const pageConnection = await getConnection(state.workspaceId, "slack");

  if (!pageConnection) {
    throw new OAuthCallbackError(
      "slack_page_not_connected",
      "Slack page is not connected.",
    );
  }

  if (pageConnection.providerAccountId !== connection.workspaceId) {
    throw new OAuthCallbackError(
      "slack_page_mismatch",
      "Slack account belongs to a different page.",
    );
  }

  if (
    readObject(pageConnection.metadata).enforceEmailMatch === true &&
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
  c: WorkspaceSettingsContext,
  workspaceId: string,
  userId: string,
  pageConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    workspaceId,
    userId,
    "slack",
  );
  const pageMetadata = readObject(pageConnection?.metadata);

  return {
    configured: hasSlackOAuthConfig(c),
    connected: pageConnection?.status === "connected",
    integration: "slack",
    personal: {
      connected: personalConnection?.status === "connected",
      connectedAt: personalConnection?.createdAt.toISOString(),
      email: personalConnection?.email ?? undefined,
      name: personalConnection?.displayName ?? undefined,
      providerAccountId: personalConnection?.providerAccountId,
      providerWorkspaceId:
        personalConnection?.providerWorkspaceId ?? undefined,
      updatedAt: personalConnection?.updatedAt.toISOString(),
    },
    page: {
      connected: pageConnection?.status === "connected",
      connectedAt: pageConnection?.createdAt.toISOString(),
      enforceEmailMatch: pageMetadata.enforceEmailMatch === true,
      workspaceId: pageConnection?.providerAccountId,
      workspaceName: pageConnection?.displayName ?? undefined,
      enterpriseId:
        typeof pageMetadata.enterpriseId === "string"
          ? pageMetadata.enterpriseId
          : undefined,
      enterpriseName:
        typeof pageMetadata.enterpriseName === "string"
          ? pageMetadata.enterpriseName
          : undefined,
      isEnterpriseInstall: pageMetadata.isEnterpriseInstall === true,
      teamId:
        typeof pageMetadata.teamId === "string"
          ? pageMetadata.teamId
          : undefined,
      teamName:
        typeof pageMetadata.teamName === "string"
          ? pageMetadata.teamName
          : undefined,
      updatedAt: pageConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateSlackIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveWorkspace(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only workspace admins can manage Slack settings." },
      403,
    );
  }

  const connection = await getConnection(auth.workspaceId, "slack");

  if (!connection) {
    return c.json({ message: "Slack page is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeSlackEmailMismatches(auth.workspaceId)
      : 0;

  await db
    .update(workspaceIntegration)
    .set({
      metadata: {
        ...metadata,
        enforceEmailMatch,
      },
      updatedAt: new Date(),
    })
    .where(eq(workspaceIntegration.id, connection.id));
  const updatedConnection =
    (await getConnection(auth.workspaceId, "slack")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getSlackIntegrationStatus(
      c,
      auth.workspaceId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectSlackIntegration(
  c: Context<AppBindings>,
  auth: {
    workspaceId: string;
    user: { id: string };
    membership: { role: string };
  },
) {
  const body = await c.req.json().catch(() => ({}));
  const mode = readIntegrationMode(body);

  if (mode === "page") {
    if (!isPrivilegedOrgRole(auth.membership.role)) {
      return c.json(
        { message: "Only workspace admins can disconnect the Slack page." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(workspaceIntegration)
        .where(
          and(
            eq(workspaceIntegration.workspaceId, auth.workspaceId),
            eq(workspaceIntegration.integrationKey, "slack"),
          ),
        )
        .returning({ id: workspaceIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.workspaceId, auth.workspaceId),
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
        eq(userIntegration.workspaceId, auth.workspaceId),
        eq(userIntegration.userId, auth.user.id),
        eq(userIntegration.integrationKey, "slack"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeSlackConnection(
  c: WorkspaceSettingsContext,
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
  const pageId = token.enterprise?.id ?? token.team?.id ?? "slack";
  const pageName = token.enterprise?.name ?? token.team?.name ?? "Slack";

  return {
    accessToken: token.access_token!,
    appId: token.app_id,
    botUserId: token.bot_user_id,
    email: authedUser?.profile?.email,
    enterpriseId: token.enterprise?.id,
    enterpriseName: token.enterprise?.name,
    isEnterpriseInstall: token.is_enterprise_install,
    name: authedUser?.profile?.real_name || authedUser?.name,
    workspaceId: pageId,
    workspaceName: pageName,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "channels:history channels:read files:read users:read users:read.email",
    teamId: token.team?.id,
    teamName: token.team?.name,
    tokenType: token.token_type ?? "bot",
    userAccessToken: token.authed_user?.access_token,
    userId: authedUserId ?? token.bot_user_id ?? pageId,
    userRefreshToken: token.authed_user?.refresh_token,
    userScopes: token.authed_user?.scope,
    userTokenType: token.authed_user?.token_type,
  };
}

async function upsertSlackPageConnection(
  state: OAuthState,
  connection: SlackConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.workspaceId, "slack");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.workspaceName,
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
    providerAccountId: connection.workspaceId,
    refreshToken: connection.refreshToken,
    scopes: connection.scopes,
    status: "connected",
    tokenType: connection.tokenType,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(workspaceIntegration)
      .set(values)
      .where(eq(workspaceIntegration.id, existing.id));
    return;
  }

  await db.insert(workspaceIntegration).values({
    id: crypto.randomUUID(),
    workspaceId: state.workspaceId,
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
    state.workspaceId,
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
      workspaceName: connection.workspaceName,
      teamId: connection.teamId,
      teamName: connection.teamName,
    },
    providerAccountId: connection.userId,
    providerWorkspaceId: connection.workspaceId,
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
    workspaceId: state.workspaceId,
    userId: state.userId,
    integrationKey: "slack",
    createdAt: now,
    ...values,
  });
}

async function removeSlackEmailMismatches(workspaceId: string) {
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
        eq(userIntegration.workspaceId, workspaceId),
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
