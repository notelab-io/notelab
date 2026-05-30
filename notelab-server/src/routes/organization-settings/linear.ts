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

type LinearConnection = Awaited<ReturnType<typeof exchangeLinearConnection>>;

export function createLinearOAuthUrl(
  c: OrganizationSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "workspace";
    organizationId: string;
    userId: string;
  },
) {
  const clientId = getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID");

  if (!clientId || !getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET")) {
    return oauthConfigError("LINEAR_OAUTH_NOT_CONFIGURED", "Linear OAuth is not configured.");
  }

  return {
    url: withParams("https://linear.app/oauth/authorize", {
      client_id: clientId,
      redirect_uri: getCallbackUrl(c, "linear"),
      response_type: "code",
      scope: "read",
      state: signState(c, {
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
        enforceEmailMatch: input.enforceEmailMatch,
        integration: "linear",
        mode: input.mode,
        organizationId: input.organizationId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasLinearOAuthConfig(c: OrganizationSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleLinearOAuthCallback(
  c: OrganizationSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "workspace";
  const connection = await exchangeLinearConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "workspace") {
    const membership = await getMembership(state.organizationId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only organization admins can connect Linear.",
      );
    }

    if (
      state.enforceEmailMatch === true &&
      !emailsMatch(connection.email, userRecord.email)
    ) {
      throw new OAuthCallbackError(
        "email_mismatch",
        "Linear email does not match Notelab email.",
      );
    }

    await upsertLinearWorkspaceConnection(state, connection);
    await upsertLinearUserConnection(state, connection);
    return;
  }

  const workspaceConnection = await getConnection(state.organizationId, "linear");

  if (!workspaceConnection) {
    throw new OAuthCallbackError(
      "linear_workspace_not_connected",
      "Linear workspace is not connected.",
    );
  }

  if (workspaceConnection.providerAccountId !== connection.organizationId) {
    throw new OAuthCallbackError(
      "linear_workspace_mismatch",
      "Linear account belongs to a different workspace.",
    );
  }

  if (
    readObject(workspaceConnection.metadata).enforceEmailMatch === true &&
    !emailsMatch(connection.email, userRecord.email)
  ) {
    throw new OAuthCallbackError(
      "email_mismatch",
      "Linear email does not match Notelab email.",
    );
  }

  await upsertLinearUserConnection(state, connection);
}

export async function getLinearIntegrationStatus(
  c: OrganizationSettingsContext,
  organizationId: string,
  userId: string,
  workspaceConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    organizationId,
    userId,
    "linear",
  );
  const workspaceMetadata = readObject(workspaceConnection?.metadata);

  return {
    configured: hasLinearOAuthConfig(c),
    connected: workspaceConnection?.status === "connected",
    integration: "linear",
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
      organizationUrlKey:
        typeof workspaceMetadata.organizationUrlKey === "string"
          ? workspaceMetadata.organizationUrlKey
          : undefined,
      updatedAt: workspaceConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateLinearIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only organization admins can manage Linear settings." },
      403,
    );
  }

  const connection = await getConnection(auth.organizationId, "linear");

  if (!connection) {
    return c.json({ message: "Linear workspace is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeLinearEmailMismatches(auth.organizationId)
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
    (await getConnection(auth.organizationId, "linear")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getLinearIntegrationStatus(
      c,
      auth.organizationId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectLinearIntegration(
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
        { message: "Only organization admins can disconnect the Linear workspace." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(organizationIntegration)
        .where(
          and(
            eq(organizationIntegration.organizationId, auth.organizationId),
            eq(organizationIntegration.integrationKey, "linear"),
          ),
        )
        .returning({ id: organizationIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.organizationId, auth.organizationId),
            eq(userIntegration.integrationKey, "linear"),
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
        eq(userIntegration.integrationKey, "linear"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeLinearConnection(
  c: OrganizationSettingsContext,
  code: string,
) {
  const token = await postForm<TokenResponse>("https://api.linear.app/oauth/token", {
    client_id: getRequiredStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID"),
    client_secret: getRequiredStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getCallbackUrl(c, "linear"),
  });

  assertAccessToken(token);

  const viewer = await fetchLinearViewer(token.access_token!);

  return {
    accessToken: token.access_token!,
    email: viewer.email,
    name: viewer.name,
    organizationId: viewer.organization.id,
    organizationName: viewer.organization.name,
    organizationUrlKey: viewer.organization.urlKey,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "read",
    tokenType: token.token_type ?? "bearer",
    userId: viewer.id,
  };
}

async function upsertLinearWorkspaceConnection(
  state: OAuthState,
  connection: LinearConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.organizationId, "linear");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.organizationName,
    expiresAt: null,
    metadata: {
      enforceEmailMatch: state.enforceEmailMatch === true,
      organizationUrlKey: connection.organizationUrlKey,
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
    integrationKey: "linear",
    createdAt: now,
    ...values,
  });
}

async function upsertLinearUserConnection(
  state: OAuthState,
  connection: LinearConnection,
) {
  const now = new Date();
  const existing = await getUserConnection(
    state.organizationId,
    state.userId,
    "linear",
  );
  const values = {
    accessToken: connection.accessToken,
    displayName: connection.name ?? connection.email ?? "Linear user",
    email: connection.email ?? null,
    expiresAt: null,
    metadata: {
      organizationName: connection.organizationName,
      organizationUrlKey: connection.organizationUrlKey,
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
    integrationKey: "linear",
    createdAt: now,
    ...values,
  });
}

async function removeLinearEmailMismatches(organizationId: string) {
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
        eq(userIntegration.integrationKey, "linear"),
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
