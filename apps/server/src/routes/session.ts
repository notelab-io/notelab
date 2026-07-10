import { Hono } from "hono";
import type { Context } from "hono";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { account, member, session as authSession, workspace } from "../db/schema";
import { isSelfHostedRuntime } from "../runtime-adapter";
import type { AppBindings } from "../types";

export const sessionRoutes = new Hono<AppBindings>();

sessionRoutes.get("/", (c) => timed(c, "route_session_total", async () => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user) {
    return c.json({ user: null, session: null }, 401);
  }

  const [selfHostedWorkspaceId, hasPassword] = await Promise.all([
    timed(c, "route_session_pin", () =>
      ensurePinnedWorkspaceMembership(
        user.id,
        session?.id,
      ),
    ),
    timed(
      c,
      "route_session_has_password",
      () => getUserHasPassword(user.id),
    ),
  ]);
  const responseSession =
    session &&
    selfHostedWorkspaceId &&
    session.activeWorkspaceId !== selfHostedWorkspaceId
      ? { ...session, activeWorkspaceId: selfHostedWorkspaceId }
      : session;

  return c.json({
    session: responseSession,
    workspacePinned: isSelfHostedRuntime(),
    user: {
      ...user,
      hasPassword,
    },
  });
}));

async function ensurePinnedWorkspaceMembership(
  userId: string,
  sessionId?: string | null,
) {
  if (!isSelfHostedRuntime()) {
    return null;
  }

  const workspaceId = await getPinnedWorkspaceId();

  if (!workspaceId) {
    return null;
  }

  const [existingMembership] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, workspaceId), eq(member.userId, userId)))
    .limit(1);

  if (!existingMembership) {
    await db
      .insert(member)
      .values({
        id: crypto.randomUUID(),
        organizationId: workspaceId,
        role: "member",
        userId,
      })
      .onConflictDoNothing();
  }

  if (sessionId) {
    await db
      .update(authSession)
      .set({ activeWorkspaceId: workspaceId, updatedAt: new Date() })
      .where(eq(authSession.id, sessionId));
  }

  return workspaceId;
}

async function getPinnedWorkspaceId() {
  const [pinnedWorkspace] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .orderBy(asc(workspace.createdAt))
    .limit(1);

  return pinnedWorkspace?.id ?? null;
}

async function getUserHasPassword(userId: string) {
  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    )
    .limit(1);

  return Boolean(credentialAccount);
}

async function timed<T>(
  c: Context<AppBindings>,
  name: string,
  run: () => Promise<T>,
) {
  const startedAt = performance.now();

  try {
    return await run();
  } finally {
    c.get("serverTimings").push(
      `notelab_${name};dur=${Math.round(performance.now() - startedAt)}`,
    );
  }
}
