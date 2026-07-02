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
  googleScopes,
  OAuthCallbackError,
  type OAuthState,
  type WorkspaceSettingsContext,
  type TokenResponse,
} from "./types";

type GoogleDriveConnection = Awaited<ReturnType<typeof exchangeGoogleDriveConnection>>;

export function createGoogleDriveOAuthUrl(
  c: WorkspaceSettingsContext,
  input: {
    enforceEmailMatch: boolean;
    mode: "personal" | "page";
    workspaceId: string;
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
        workspaceId: input.workspaceId,
        userId: input.userId,
      }),
    }),
  };
}

export function hasGoogleDriveOAuthConfig(c: WorkspaceSettingsContext) {
  return Boolean(getGoogleClientId(c) && getGoogleClientSecret(c));
}

export async function handleGoogleDriveOAuthCallback(
  c: WorkspaceSettingsContext,
  code: string,
  state: OAuthState,
) {
  const mode = state.mode ?? "page";
  const connection = await exchangeGoogleDriveConnection(c, code);
  const userRecord = await getUserRecord(state.userId);

  if (!userRecord) {
    throw new OAuthCallbackError("unauthorized", "Could not verify Notelab user.");
  }

  if (mode === "page") {
    const membership = await getMembership(state.workspaceId, state.userId);

    if (!isPrivilegedOrgRole(membership?.role)) {
      throw new OAuthCallbackError(
        "admin_required",
        "Only workspace admins can connect Google Drive.",
      );
    }

    if (!connection.hostedDomain) {
      throw new OAuthCallbackError(
        "google_page_domain_required",
        "Use a Google Page account with a hosted domain.",
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

    await upsertGoogleDrivePageConnection(state, connection);
    await upsertGoogleDriveUserConnection(state, connection);
    return;
  }

  const pageConnection = await getConnection(
    state.workspaceId,
    "google-drive",
  );

  if (!pageConnection) {
    throw new OAuthCallbackError(
      "google_drive_page_not_connected",
      "Google Drive page is not connected.",
    );
  }

  const pageDomain = readObject(pageConnection.metadata).hostedDomain;

  if (
    typeof pageDomain === "string" &&
    pageDomain &&
    connection.hostedDomain !== pageDomain
  ) {
    throw new OAuthCallbackError(
      "google_drive_page_mismatch",
      "Google Drive account belongs to a different page domain.",
    );
  }

  if (
    readObject(pageConnection.metadata).enforceEmailMatch === true &&
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
  c: WorkspaceSettingsContext,
  workspaceId: string,
  userId: string,
  pageConnection: Awaited<ReturnType<typeof getConnection>>,
) {
  const personalConnection = await getUserConnection(
    workspaceId,
    userId,
    "google-drive",
  );
  const pageMetadata = readObject(pageConnection?.metadata);

  return {
    configured: hasGoogleDriveOAuthConfig(c),
    connected: pageConnection?.status === "connected",
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
      providerWorkspaceId:
        personalConnection?.providerWorkspaceId ?? undefined,
      updatedAt: personalConnection?.updatedAt.toISOString(),
    },
    page: {
      connected: pageConnection?.status === "connected",
      connectedAt: pageConnection?.createdAt.toISOString(),
      email:
        typeof pageMetadata.email === "string"
          ? pageMetadata.email
          : undefined,
      enforceEmailMatch: pageMetadata.enforceEmailMatch === true,
      hostedDomain:
        typeof pageMetadata.hostedDomain === "string"
          ? pageMetadata.hostedDomain
          : undefined,
      providerAccountId: pageConnection?.providerAccountId,
      updatedAt: pageConnection?.updatedAt.toISOString(),
    },
  };
}

export async function updateGoogleDriveIntegrationSettings(
  c: Context<AppBindings>,
) {
  const auth = await requireActiveWorkspace(c);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isPrivilegedOrgRole(auth.membership.role)) {
    return c.json(
      { message: "Only workspace admins can manage Google Drive settings." },
      403,
    );
  }

  const connection = await getConnection(auth.workspaceId, "google-drive");

  if (!connection) {
    return c.json({ message: "Google Drive page is not connected." }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    enforceEmailMatch?: unknown;
  };
  const enforceEmailMatch = Boolean(body.enforceEmailMatch);
  const metadata = readObject(connection.metadata);
  const wasEnforced = metadata.enforceEmailMatch === true;
  const removedPersonalConnections =
    enforceEmailMatch && !wasEnforced
      ? await removeGoogleDriveEmailMismatches(auth.workspaceId)
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
    (await getConnection(auth.workspaceId, "google-drive")) ?? connection;

  return c.json({
    removedPersonalConnections,
    status: await getGoogleDriveIntegrationStatus(
      c,
      auth.workspaceId,
      auth.user.id,
      updatedConnection,
    ),
  });
}

export async function disconnectGoogleDriveIntegration(
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
        { message: "Only workspace admins can disconnect Google Drive." },
        403,
      );
    }

    const [deleted] = await Promise.all([
      db
        .delete(workspaceIntegration)
        .where(
          and(
            eq(workspaceIntegration.workspaceId, auth.workspaceId),
            eq(workspaceIntegration.integrationKey, "google-drive"),
          ),
        )
        .returning({ id: workspaceIntegration.id }),
      db
        .delete(userIntegration)
        .where(
          and(
            eq(userIntegration.workspaceId, auth.workspaceId),
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
        eq(userIntegration.workspaceId, auth.workspaceId),
        eq(userIntegration.userId, auth.user.id),
        eq(userIntegration.integrationKey, "google-drive"),
      ),
    )
    .returning({ id: userIntegration.id });

  return c.json({ connected: false, deleted: deleted.length > 0 });
}

async function exchangeGoogleDriveConnection(
  c: WorkspaceSettingsContext,
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

async function upsertGoogleDrivePageConnection(
  state: OAuthState,
  connection: GoogleDriveConnection,
) {
  const now = new Date();
  const existing = await getConnection(state.workspaceId, "google-drive");
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
      .update(workspaceIntegration)
      .set(values)
      .where(eq(workspaceIntegration.id, existing.id));
    return;
  }

  await db.insert(workspaceIntegration).values({
    id: crypto.randomUUID(),
    workspaceId: state.workspaceId,
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
    state.workspaceId,
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
    providerWorkspaceId: connection.hostedDomain,
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
    integrationKey: "google-drive",
    createdAt: now,
    ...values,
  });
}

async function removeGoogleDriveEmailMismatches(workspaceId: string) {
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

function getGoogleClientId(c: WorkspaceSettingsContext) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getGoogleClientSecret(c: WorkspaceSettingsContext) {
  return getStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_SECRET");
}

function getRequiredGoogleClientId(c: WorkspaceSettingsContext) {
  return getRequiredStringEnv(c.env, "GOOGLE_OAUTH_CLIENT_ID");
}

function getRequiredGoogleClientSecret(c: WorkspaceSettingsContext) {
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
