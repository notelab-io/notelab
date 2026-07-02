import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";

import { getMembership, isPrivilegedOrgRole } from "../../access";
import { getRequiredStringEnv, getStringEnv } from "../../config";
import { db } from "../../db";
import { workspaceIntegration, user, userIntegration } from "../../db/schema";
import type { AppBindings } from "../../types";
import {
  assertAccessToken,
  fetchJson,
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

type GithubConnection = Awaited<ReturnType<typeof exchangeGithubConnection>>;

export function createGithubOAuthUrl(
  c: WorkspaceSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    githubWorkspaceLogin?: string;
    mode: "personal" | "page";
    workspaceId: string;
    userId: string;
  },
) {
  const clientId = getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID");

  if (!clientId || !getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET")) {
    return oauthConfigError("GITHUB_OAUTH_NOT_CONFIGURED", "GitHub OAuth is not configured.");
  }

  const githubWorkspaceLogin = normalizeGithubLogin(
    input.githubWorkspaceLogin,
  );

  if (input.mode === "page" && !githubWorkspaceLogin) {
    return oauthConfigError(
      "GITHUB_ORGANIZATION_REQUIRED",
      "Enter the GitHub workspace login before connecting.",
    );
  }

  return {
    url: withParams("https://github.com/login/oauth/authorize", {
      client_id: clientId,
      redirect_uri: getCallbackUrl(c, "github"),
      scope: "read:org read:user user:email repo",
      state: signState(c, {
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
        enforceEmailMatch: input.enforceEmailMatch,
        githubWorkspaceLogin,
        integration: "github",
        mode: input.mode,
        workspaceId: input.workspaceId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasGithubOAuthConfig(c: WorkspaceSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleGithubOAuthCallback(
  c: WorkspaceSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "page";
  const pageConnection = await getConnection(state.workspaceId, "github");
  const workspaceLogin =
    mode === "page"
      ? normalizeGithubLogin(state.githubWorkspaceLogin)
      : normalizeGithubLogin(
          readObject(pageConnection?.metadata).workspaceLogin,
        );

  if (!workspaceLogin) {
    throw new OAuthCallbackError(
      "github_workspace_required",
      "GitHub workspace login is required.",
    );
  }

  const connection = await exchangeGithubConnection(c, code, workspaceLogin);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "page") {
    const membership = await getMembership(state.workspaceId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only workspace admins can connect GitHub.",
      );
    }

    if (connection.workspaceRole !== "admin") {
      throw new OAuthCallbackError(
        "github_admin_required",
        "Use a GitHub account that can administer this workspace.",
      );
    }

    if (
      state.enforceEmailMatch === true &&
      !emailsMatch(connection.email, userRecord.email)
    ) {
      throw new OAuthCallbackError(
        "email_mismatch",
        "GitHub email does not match Notelab email.",
      );
    }

    await upsertGithubPageConnection(state, connection);
    await upsertGithubUserConnection(state, connection);
    return;
  }

  if (!pageConnection) {
    throw new OAuthCallbackError(
      "github_page_not_connected",
      "GitHub workspace is not connected.",
    );
  }

  if (pageConnection.providerAccountId !== connection.workspaceId) {
    throw new OAuthCallbackError(
      "github_page_mismatch",
      "GitHub account belongs to a different workspace.",
    );
  }

  if (
    readObject(pageConnection.metadata).enforceEmailMatch === true &&
    !emailsMatch(connection.email, userRecord.email)
  ) {
    throw new OAuthCallbackError(
      "email_mismatch",
      "GitHub email does not match Notelab email.",
    );
  }

  await upsertGithubUserConnection(state, connection);
}

export async function getGithubIntegrationStatus(
  c: WorkspaceSettingsContext,
  workspaceId: string,
  userId: string,
  pageConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    workspaceId,
    userId,
    "github",
  );
  const pageMetadata = readObject(pageConnection?.metadata);
  const personalMetadata = readObject(personalConnection?.metadata);

  return {
    configured: hasGithubOAuthConfig(c),
    connected: pageConnection?.status === "connected",
    integration: "github",
    personal: {
      connected: personalConnection?.status === "connected",
      connectedAt: personalConnection?.createdAt.toISOString(),
      email: personalConnection?.email ?? undefined,
      login:
        typeof personalMetadata.login === "string"
          ? personalMetadata.login
          : undefined,
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
      workspaceLogin:
        typeof pageMetadata.workspaceLogin === "string"
          ? pageMetadata.workspaceLogin
          : undefined,
      workspaceName: pageConnection?.displayName ?? undefined,
      updatedAt: pageConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateGithubIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveWorkspace(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only workspace admins can manage GitHub settings." },
      403,
    );
  }

  const connection = await getConnection(auth.workspaceId, "github");

  if (!connection) {
    return c.json({ message: "GitHub workspace is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeGithubEmailMismatches(auth.workspaceId)
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
    (await getConnection(auth.workspaceId, "github")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getGithubIntegrationStatus(
      c,
      auth.workspaceId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectGithubIntegration(
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
        { message: "Only workspace admins can disconnect the GitHub workspace." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(workspaceIntegration)
        .where(
          and(
            eq(workspaceIntegration.workspaceId, auth.workspaceId),
            eq(workspaceIntegration.integrationKey, "github"),
          ),
        )
        .returning({ id: workspaceIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.workspaceId, auth.workspaceId),
            eq(userIntegration.integrationKey, "github"),
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
        eq(userIntegration.integrationKey, "github"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeGithubConnection(
  c: WorkspaceSettingsContext,
  code: string,
  workspaceLogin: string,
) {
  const token = await postForm<TokenResponse>(
    "https://github.com/login/oauth/access_token",
    {
      client_id: getRequiredStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID"),
      client_secret: getRequiredStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: getCallbackUrl(c, "github"),
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
  const emails = await fetchJson<
    Array<{ email: string; primary: boolean; verified: boolean }>
  >("https://api.github.com/user/emails", token.access_token!);
  const membership = await fetchJson<{
    workspace: {
      id: number;
      login: string;
      description?: string | null;
      name?: string | null;
    };
    role: "admin" | "member";
    state: string;
  }>(
    `https://api.github.com/user/memberships/orgs/${encodeURIComponent(
      workspaceLogin,
    )}`,
    token.access_token!,
  );
  const email =
    emails.find((item) => item.primary && item.verified)?.email ??
    emails.find((item) => item.verified)?.email ??
    profile.email ??
    null;

  if (membership.state !== "active") {
    throw new OAuthCallbackError(
      "github_membership_required",
      "Use a GitHub account that is an active member of this workspace.",
    );
  }

  return {
    accessToken: token.access_token!,
    email,
    name: profile.name,
    workspaceId: String(membership.workspace.id),
    workspaceLogin: membership.workspace.login,
    workspaceName:
      membership.workspace.name ||
      membership.workspace.login ||
      workspaceLogin,
    workspaceRole: membership.role,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "read:org read:user user:email repo",
    tokenType: token.token_type ?? "bearer",
    userId: String(profile.id),
    userLogin: profile.login,
  };
}

async function upsertGithubPageConnection(
  state: OAuthState,
  connection: GithubConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.workspaceId, "github");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.workspaceName,
    expiresAt: null,
    metadata: {
      connectedUserEmail: connection.email,
      connectedUserId: connection.userId,
      connectedUserLogin: connection.userLogin,
      connectedUserName: connection.name,
      enforceEmailMatch: state.enforceEmailMatch === true,
      workspaceLogin: connection.workspaceLogin,
      workspaceRole: connection.workspaceRole,
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
    integrationKey: "github",
    createdAt: now,
    ...values,
  });
}

async function upsertGithubUserConnection(
  state: OAuthState,
  connection: GithubConnection,
) {
  const now = new Date();
  const existing = await getUserConnection(
    state.workspaceId,
    state.userId,
    "github",
  );
  const values = {
    accessToken: connection.accessToken,
    displayName: connection.name ?? connection.userLogin,
    email: connection.email,
    expiresAt: null,
    metadata: {
      login: connection.userLogin,
      workspaceLogin: connection.workspaceLogin,
      workspaceName: connection.workspaceName,
      workspaceRole: connection.workspaceRole,
    },
    providerAccountId: connection.userId,
    providerWorkspaceId: connection.workspaceId,
    refreshToken: connection.refreshToken,
    scopes: connection.scopes,
    status: "connected",
    tokenType: connection.tokenType,
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
    integrationKey: "github",
    createdAt: now,
    ...values,
  });
}

async function removeGithubEmailMismatches(workspaceId: string) {
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
        eq(userIntegration.integrationKey, "github"),
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

function normalizeGithubLogin(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/^@/, "")
    : undefined;
}
