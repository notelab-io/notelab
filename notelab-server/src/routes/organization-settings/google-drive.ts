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
  googleScopes,
  OAuthCallbackError,
  type OAuthState,
  type OrganizationSettingsContext,
  type TokenResponse,
} from "./types";

type GoogleDriveConnection = Awaited<ReturnType<typeof exchangeGoogleDriveConnection>>;

export function createGoogleDriveOAuthUrl(
  c: OrganizationSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "workspace";
    organizationId: string;
    userId: string;
  },
) {
  const clientId = getGoogleClientId(c);

  if (!clientId || !getGoogleClientSecret(c)) {
    return oauthConfigError("GOOGLE_OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.");
  }

  return {
    url: withParams("https://accounts.google.com/o/oauth2/v2/auth", {
      access_type: "offline",
      client_id: clientId,
      include_granted_scopes: "true",
      prompt: "consent",
      redirect_uri: getCallbackUrl(c, "google-drive"),
      response_type: "code",
      scope: googleScopes["google-drive"].join(" "),
      state: signState(c, {
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
        enforceEmailMatch: input.enforceEmailMatch,
        integration: "google-drive",
        mode: input.mode,
        organizationId: input.organizationId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasGoogleDriveOAuthConfig(c: OrganizationSettingsContext) {
  return Boolean(getGoogleClientId(c) && getGoogleClientSecret(c));
}

export async function handleGoogleDriveOAuthCallback(
  c: OrganizationSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "workspace";
  const connection = await exchangeGoogleDriveConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "workspace") {
    const membership = await getMembership(state.organizationId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only organization admins can connect Google Drive.",
      );
    }

    if (!connection.hostedDomain) {
      throw new OAuthCallbackError(
        "google_workspace_domain_required",
        "Use a Google Workspace account with a hosted domain.",
      );
    }

    if (
      state.enforceEmailMatch === true &&
      !emailsMatch(connection.email, userRecord.email)
    ) {
      throw new OAuthCallbackError(
        "email_mismatch",
        "Google Drive email does not match Notelab email.",
      );
    }

    await upsertGoogleDriveWorkspaceConnection(state, connection);
    await upsertGoogleDriveUserConnection(state, connection);
    return;
  }

  const workspaceConnection = await getConnection(
    state.organizationId,
    "google-drive",
  );

  if (!workspaceConnection) {
    throw new OAuthCallbackError(
      "google_drive_workspace_not_connected",
      "Google Drive workspace is not connected.",
    );
  }

  const workspaceDomain = readObject(workspaceConnection.metadata).hostedDomain;

  if (
    typeof workspaceDomain === "string" &&
    workspaceDomain &&
    connection.hostedDomain !== workspaceDomain
  ) {
    throw new OAuthCallbackError(
      "google_drive_workspace_mismatch",
      "Google Drive account belongs to a different workspace domain.",
    );
  }

  if (
    readObject(workspaceConnection.metadata).enforceEmailMatch === true &&
    !emailsMatch(connection.email, userRecord.email)
  ) {
    throw new OAuthCallbackError(
      "email_mismatch",
      "Google Drive email does not match Notelab email.",
    );
  }

  await upsertGoogleDriveUserConnection(state, connection);
}

export async function getGoogleDriveIntegrationStatus(
  c: OrganizationSettingsContext,
  organizationId: string,
  userId: string,
  workspaceConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    organizationId,
    userId,
    "google-drive",
  );
  const workspaceMetadata = readObject(workspaceConnection?.metadata);

  return {
    configured: hasGoogleDriveOAuthConfig(c),
    connected: workspaceConnection?.status === "connected",
    integration: "google-drive",
    personal: {
      connected: personalConnection?.status === "connected",
      connectedAt: personalConnection?.createdAt.toISOString(),
      email: personalConnection?.email ?? undefined,
      hostedDomain:
        typeof readObject(personalConnection?.metadata).hostedDomain === "string"
          ? (readObject(personalConnection?.metadata).hostedDomain as string)
          : undefined,
      providerAccountId: personalConnection?.providerAccountId,
      providerOrganizationId:
        personalConnection?.providerOrganizationId ?? undefined,
      updatedAt: personalConnection?.updatedAt.toISOString(),
    },
    workspace: {
      connected: workspaceConnection?.status === "connected",
      connectedAt: workspaceConnection?.createdAt.toISOString(),
      email:
        typeof workspaceMetadata.email === "string"
          ? workspaceMetadata.email
          : undefined,
      enforceEmailMatch: workspaceMetadata.enforceEmailMatch === true,
      hostedDomain:
        typeof workspaceMetadata.hostedDomain === "string"
          ? workspaceMetadata.hostedDomain
          : undefined,
      providerAccountId: workspaceConnection?.providerAccountId,
      updatedAt: workspaceConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateGoogleDriveIntegrationSettings(
  c: Context<AppBindings>,
) {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only organization admins can manage Google Drive settings." },
      403,
    );
  }

  const connection = await getConnection(auth.organizationId, "google-drive");

  if (!connection) {
    return c.json({ message: "Google Drive workspace is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeGoogleDriveEmailMismatches(auth.organizationId)
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
    (await getConnection(auth.organizationId, "google-drive")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getGoogleDriveIntegrationStatus(
      c,
      auth.organizationId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectGoogleDriveIntegration(
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
        { message: "Only organization admins can disconnect Google Drive." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(organizationIntegration)
        .where(
          and(
            eq(organizationIntegration.organizationId, auth.organizationId),
            eq(organizationIntegration.integrationKey, "google-drive"),
          ),
        )
        .returning({ id: organizationIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.organizationId, auth.organizationId),
            eq(userIntegration.integrationKey, "google-drive"),
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
        eq(userIntegration.integrationKey, "google-drive"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeGoogleDriveConnection(
  c: OrganizationSettingsContext,
  code: string,
) {
  const token = await postForm<TokenResponse>("https://oauth2.googleapis.com/token", {
    client_id: getRequiredGoogleClientId(c),
    client_secret: getRequiredGoogleClientSecret(c),
    code,
    grant_type: "authorization_code",
    redirect_uri: getCallbackUrl(c, "google-drive"),
  });

  assertAccessToken(token);

  const claims = decodeJwt(token.id_token);
  const email = typeof claims.email === "string" ? claims.email : null;
  const hostedDomain = typeof claims.hd === "string" ? claims.hd : null;
  const providerAccountId =
    typeof claims.sub === "string" ? claims.sub : email ?? "google-drive";

  return {
    accessToken: token.access_token!,
    email,
    hostedDomain,
    providerAccountId,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ?? googleScopes["google-drive"].join(" "),
    tokenType: token.token_type ?? "bearer",
  };
}

async function upsertGoogleDriveWorkspaceConnection(
  state: OAuthState,
  connection: GoogleDriveConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.organizationId, "google-drive");
  const values = {
    accessToken: connection.accessToken,
    connectedById: state.userId,
    displayName: connection.hostedDomain ?? connection.email ?? "Google Drive",
    expiresAt: null,
    metadata: {
      email: connection.email,
      enforceEmailMatch: state.enforceEmailMatch === true,
      hostedDomain: connection.hostedDomain,
    },
    providerAccountId: connection.hostedDomain ?? connection.providerAccountId,
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
    integrationKey: "google-drive",
    createdAt: now,
    ...values,
  });
}

async function upsertGoogleDriveUserConnection(
  state: OAuthState,
  connection: GoogleDriveConnection,
) {
  const now = new Date();
  const existing = await getUserConnection(
    state.organizationId,
    state.userId,
    "google-drive",
  );
  const values = {
    accessToken: connection.accessToken,
    displayName: connection.email ?? "Google Drive user",
    email: connection.email,
    expiresAt: null,
    metadata: {
      hostedDomain: connection.hostedDomain,
    },
    providerAccountId: connection.providerAccountId,
    providerOrganizationId: connection.hostedDomain,
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
    integrationKey: "google-drive",
    createdAt: now,
    ...values,
  });
}

async function removeGoogleDriveEmailMismatches(organizationId: string) {
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
        eq(userIntegration.integrationKey, "google-drive"),
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

function getGoogleClientId(c: OrganizationSettingsContext) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getGoogleClientSecret(c: OrganizationSettingsContext) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_SECRET");
}

function getRequiredGoogleClientId(c: OrganizationSettingsContext) {
  return getRequiredStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getRequiredGoogleClientSecret(c: OrganizationSettingsContext) {
  return getRequiredStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_SECRET");
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
