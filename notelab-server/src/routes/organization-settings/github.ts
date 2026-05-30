import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";

import { getMembership, isPrivilegedOrgRole } from "../../access";
import { getRequiredStringEnv, getStringEnv } from "../../config";
import { db } from "../../db";
import { organizationIntegration, user, userIntegration } from "../../db/schema";
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
  requireActiveOrganization,
} from "./shared";
import {
  OAuthCallbackError,
  type OAuthState,
  type OrganizationSettingsContext,
  type TokenResponse,
} from "./types";

type GithubConnection = Awaited<ReturnType<typeof exchangeGithubConnection>>;

export function createGithubOAuthUrl(
  c: OrganizationSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    githubOrganizationLogin?: string;
    mode: "personal" | "workspace";
    organizationId: string;
    userId: string;
  },
) {
  const clientId = getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID");

  if (!clientId || !getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET")) {
    return oauthConfigError("GITHUB_OAUTH_NOT_CONFIGURED", "GitHub OAuth is not configured.");
  }

  const githubOrganizationLogin = normalizeGithubLogin(
    input.githubOrganizationLogin,
  );

  if (input.mode === "workspace" && !githubOrganizationLogin) {
    return oauthConfigError(
      "GITHUB_ORGANIZATION_REQUIRED",
      "Enter the GitHub organization login before connecting.",
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
        githubOrganizationLogin,
        integration: "github",
        mode: input.mode,
        organizationId: input.organizationId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasGithubOAuthConfig(c: OrganizationSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "GITHUB_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleGithubOAuthCallback(
  c: OrganizationSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "workspace";
  const workspaceConnection = await getConnection(state.organizationId, "github");
  const organizationLogin =
    mode === "workspace"
      ? normalizeGithubLogin(state.githubOrganizationLogin)
      : normalizeGithubLogin(
          readObject(workspaceConnection?.metadata).organizationLogin,
        );

  if (!organizationLogin) {
    throw new OAuthCallbackError(
      "github_organization_required",
      "GitHub organization login is required.",
    );
  }

  const connection = await exchangeGithubConnection(c, code, organizationLogin);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "workspace") {
    const membership = await getMembership(state.organizationId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only organization admins can connect GitHub.",
      );
    }

    if (connection.organizationRole !== "admin") {
      throw new OAuthCallbackError(
        "github_admin_required",
        "Use a GitHub account that can administer this organization.",
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

    await upsertGithubWorkspaceConnection(state, connection);
    await upsertGithubUserConnection(state, connection);
    return;
  }

  if (!workspaceConnection) {
    throw new OAuthCallbackError(
      "github_workspace_not_connected",
      "GitHub organization is not connected.",
    );
  }

  if (workspaceConnection.providerAccountId !== connection.organizationId) {
    throw new OAuthCallbackError(
      "github_workspace_mismatch",
      "GitHub account belongs to a different organization.",
    );
  }

  if (
    readObject(workspaceConnection.metadata).enforceEmailMatch === true &&
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
  c: OrganizationSettingsContext,
  organizationId: string,
  userId: string,
  workspaceConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    organizationId,
    userId,
    "github",
  );
  const workspaceMetadata = readObject(workspaceConnection?.metadata);
  const personalMetadata = readObject(personalConnection?.metadata);

  return {
    configured: hasGithubOAuthConfig(c),
    connected: workspaceConnection?.status === "connected",
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
      providerOrganizationId:
        personalConnection?.providerOrganizationId ?? undefined,
      updatedAt: personalConnection?.updatedAt.toISOString(),
    },
    workspace: {
      connected: workspaceConnection?.status === "connected",
      connectedAt: workspaceConnection?.createdAt.toISOString(),
      enforceEmailMatch: workspaceMetadata.enforceEmailMatch === true,
      organizationId: workspaceConnection?.providerAccountId,
      organizationLogin:
        typeof workspaceMetadata.organizationLogin === "string"
          ? workspaceMetadata.organizationLogin
          : undefined,
      organizationName: workspaceConnection?.displayName ?? undefined,
      updatedAt: workspaceConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateGithubIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only organization admins can manage GitHub settings." },
      403,
    );
  }

  const connection = await getConnection(auth.organizationId, "github");

  if (!connection) {
    return c.json({ message: "GitHub organization is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeGithubEmailMismatches(auth.organizationId)
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
    (await getConnection(auth.organizationId, "github")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getGithubIntegrationStatus(
      c,
      auth.organizationId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectGithubIntegration(
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
        { message: "Only organization admins can disconnect the GitHub organization." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(organizationIntegration)
        .where(
          and(
            eq(organizationIntegration.organizationId, auth.organizationId),
            eq(organizationIntegration.integrationKey, "github"),
          ),
        )
        .returning({ id: organizationIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.organizationId, auth.organizationId),
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
        eq(userIntegration.organizationId, auth.organizationId),
        eq(userIntegration.userId, auth.user.id),
        eq(userIntegration.integrationKey, "github"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeGithubConnection(
  c: OrganizationSettingsContext,
  code: string,
  organizationLogin: string,
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
    organization: {
      id: number;
      login: string;
      description?: string | null;
      name?: string | null;
    };
    role: "admin" | "member";
    state: string;
  }>(
    `https://api.github.com/user/memberships/orgs/${encodeURIComponent(
      organizationLogin,
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
      "Use a GitHub account that is an active member of this organization.",
    );
  }

  return {
    accessToken: token.access_token!,
    email,
    name: profile.name,
    organizationId: String(membership.organization.id),
    organizationLogin: membership.organization.login,
    organizationName:
      membership.organization.name ||
      membership.organization.login ||
      organizationLogin,
    organizationRole: membership.role,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "read:org read:user user:email repo",
    tokenType: token.token_type ?? "bearer",
    userId: String(profile.id),
    userLogin: profile.login,
  };
}

async function upsertGithubWorkspaceConnection(
  state: OAuthState,
  connection: GithubConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.organizationId, "github");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.organizationName,
    expiresAt: null,
    metadata: {
      connectedUserEmail: connection.email,
      connectedUserId: connection.userId,
      connectedUserLogin: connection.userLogin,
      connectedUserName: connection.name,
      enforceEmailMatch: state.enforceEmailMatch === true,
      organizationLogin: connection.organizationLogin,
      organizationRole: connection.organizationRole,
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
    state.organizationId,
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
      organizationLogin: connection.organizationLogin,
      organizationName: connection.organizationName,
      organizationRole: connection.organizationRole,
    },
    providerAccountId: connection.userId,
    providerOrganizationId: connection.organizationId,
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
    organizationId: state.organizationId,
    userId: state.userId,
    integrationKey: "github",
    createdAt: now,
    ...values,
  });
}

async function removeGithubEmailMismatches(organizationId: string) {
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
