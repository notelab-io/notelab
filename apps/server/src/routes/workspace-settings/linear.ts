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

type LinearConnection = Awaited<ReturnType<typeof exchangeLinearConnection>>;

export function createLinearOAuthUrl(
  c: WorkspaceSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "page";
    workspaceId: string;
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
        workspaceId: input.workspaceId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasLinearOAuthConfig(c: WorkspaceSettingsContext) {
  return Boolean(
    getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_ID") &&
      getStringEnv(c.env, "LINEAR_OAUTH_CLIENT_SECRET"),
  );
}

export async function handleLinearOAuthCallback(
  c: WorkspaceSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "page";
  const connection = await exchangeLinearConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "page") {
    const membership = await getMembership(state.workspaceId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only workspace admins can connect Linear.",
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

    await upsertLinearPageConnection(state, connection);
    await upsertLinearUserConnection(state, connection);
    return;
  }

  const pageConnection = await getConnection(state.workspaceId, "linear");

  if (!pageConnection) {
    throw new OAuthCallbackError(
      "linear_page_not_connected",
      "Linear page is not connected.",
    );
  }

  if (pageConnection.providerAccountId !== connection.workspaceId) {
    throw new OAuthCallbackError(
      "linear_page_mismatch",
      "Linear account belongs to a different page.",
    );
  }

  if (
    readObject(pageConnection.metadata).enforceEmailMatch === true &&
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
  c: WorkspaceSettingsContext,
  workspaceId: string,
  userId: string,
  pageConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    workspaceId,
    userId,
    "linear",
  );
  const pageMetadata = readObject(pageConnection?.metadata);

  return {
    configured: hasLinearOAuthConfig(c),
    connected: pageConnection?.status === "connected",
    integration: "linear",
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
      workspaceUrlKey:
        typeof pageMetadata.workspaceUrlKey === "string"
          ? pageMetadata.workspaceUrlKey
          : undefined,
      updatedAt: pageConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateLinearIntegrationSettings(c: Context<AppBindings>) {
  const auth = await requireActiveWorkspace(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only workspace admins can manage Linear settings." },
      403,
    );
  }

  const connection = await getConnection(auth.workspaceId, "linear");

  if (!connection) {
    return c.json({ message: "Linear page is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeLinearEmailMismatches(auth.workspaceId)
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
    (await getConnection(auth.workspaceId, "linear")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getLinearIntegrationStatus(
      c,
      auth.workspaceId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectLinearIntegration(
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
        { message: "Only workspace admins can disconnect the Linear page." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(workspaceIntegration)
        .where(
          and(
            eq(workspaceIntegration.workspaceId, auth.workspaceId),
            eq(workspaceIntegration.integrationKey, "linear"),
          ),
        )
        .returning({ id: workspaceIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.workspaceId, auth.workspaceId),
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
        eq(userIntegration.workspaceId, auth.workspaceId),
        eq(userIntegration.userId, auth.user.id),
        eq(userIntegration.integrationKey, "linear"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeLinearConnection(
  c: WorkspaceSettingsContext,
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
    workspaceId: viewer.workspace.id,
    workspaceName: viewer.workspace.name,
    workspaceUrlKey: viewer.workspace.urlKey,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? "read",
    tokenType: token.token_type ?? "bearer",
    userId: viewer.id,
  };
}

async function upsertLinearPageConnection(
  state: OAuthState,
  connection: LinearConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.workspaceId, "linear");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.workspaceName,
    expiresAt: null,
    metadata: {
      enforceEmailMatch: state.enforceEmailMatch === true,
      workspaceUrlKey: connection.workspaceUrlKey,
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
    state.workspaceId,
    state.userId,
    "linear",
  );
  const values = {
    accessToken: connection.accessToken,
    displayName: connection.name ?? connection.email ?? "Linear user",
    email: connection.email ?? null,
    expiresAt: null,
    metadata: {
      workspaceName: connection.workspaceName,
      workspaceUrlKey: connection.workspaceUrlKey,
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
    integrationKey: "linear",
    createdAt: now,
    ...values,
  });
}

async function removeLinearEmailMismatches(workspaceId: string) {
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
        "query Viewer { viewer { id name email workspace { id name urlKey } } }",
    }),
  });
  const body = (await response.json()) as {
    data?: {
      viewer?: {
        email?: string;
        id: string;
        name?: string;
        workspace: { id: string; name: string; urlKey?: string };
      };
    };
  };

  if (!response.ok || !body.data?.viewer) {
    throw new Error("Could not read Linear viewer.");
  }

  return body.data.viewer;
}
