import type { Context } from "hono";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import type { AppBindings } from "./types";
import {
  member,
  teamMember,
  page,
  pageAccess,
} from "./db/schema";
import { PageGraph } from "./page-graph";

export type AccessLevel = "none" | "view" | "edit" | "full";

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

export function hasAccess(
  actual: AccessLevel,
  required: Exclude<AccessLevel, "none">,
) {
  return accessRank[actual] >= accessRank[required];
}

export function normalizeAccessLevel(value: unknown): AccessLevel | null {
  return value === "view" || value === "edit" || value === "full"
    ? value
    : null;
}

export async function getMembership(workspaceId: string, userId: string) {
  const [record] = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, workspaceId), eq(member.userId, userId)),
    )
    .limit(1);

  return record ?? null;
}

export function isPrivilegedOrgRole(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export async function isWorkspaceMember(
  workspaceId: string,
  userId: string,
) {
  return Boolean(await getMembership(workspaceId, userId));
}

export async function getPageRecord(id: string) {
  const [record] = await db
    .select()
    .from(page)
    .where(and(eq(page.id, id), isNull(page.deletedAt)))
    .limit(1);

  return record ?? null;
}

export async function getEffectivePageAccess(
  pageId: string,
  userId: string,
): Promise<AccessLevel> {
  const [context] = await db
    .select({
      workspaceId: page.workspaceId,
    })
    .from(page)
    .where(and(eq(page.id, pageId), isNull(page.deletedAt)))
    .limit(1);

  if (!context) {
    return "none";
  }

  return getEffectivePageAccessInWorkspace(pageId, context.workspaceId, userId);
}

export async function getEffectivePageAccessInWorkspace(
  pageId: string,
  workspaceId: string,
  userId: string,
): Promise<AccessLevel> {
  const [membershipRows, pages, teamRows] = await Promise.all([
    db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, workspaceId),
          eq(member.userId, userId),
        ),
      )
      .limit(1),
    db
      .select({
        createdById: page.createdById,
        id: page.id,
        metadata: page.metadata,
      })
      .from(page)
      .where(
        and(
          eq(page.workspaceId, workspaceId),
          isNull(page.deletedAt),
        ),
      ),
    db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .where(eq(teamMember.userId, userId)),
  ]);

  if (membershipRows.length === 0) {
    return "none";
  }

  const graph = new PageGraph({ pages });
  const ancestorIds = graph.getAncestorIds(pageId);

  if (ancestorIds.length === 0) {
    return "none";
  }

  if (graph.hasOwnedRootAccess(ancestorIds, userId)) {
    return "full";
  }

  const targetTypes = ["user"];
  const targetIds = [userId, ...teamRows.map((row) => row.teamId)];

  if (teamRows.length > 0) {
    targetTypes.push("team");
  }

  const rules = await db
    .select({ accessLevel: pageAccess.accessLevel })
    .from(pageAccess)
    .where(
      and(
        eq(pageAccess.workspaceId, workspaceId),
        inArray(pageAccess.pageId, ancestorIds),
        inArray(pageAccess.targetType, targetTypes),
        inArray(pageAccess.targetId, targetIds),
      ),
    );

  return rules.reduce<AccessLevel>((best, rule) => {
    const next = normalizeAccessLevel(rule.accessLevel) ?? "none";

    return accessRank[next] > accessRank[best] ? next : best;
  }, "none");
}

export async function isPagePublished(pageId: string) {
  const record = await getPageRecord(pageId);

  if (!record) {
    return false;
  }

  return isPagePublishedInWorkspace(pageId, record.workspaceId);
}

export async function isPagePublishedInWorkspace(
  pageId: string,
  workspaceId: string,
) {
  const pages = await db
    .select({
      id: page.id,
      metadata: page.metadata,
    })
    .from(page)
    .where(
      and(
        eq(page.workspaceId, workspaceId),
        isNull(page.deletedAt),
      ),
    );
  const graph = new PageGraph({ pages });
  const ancestorIds = graph.getAncestorIds(pageId);

  if (ancestorIds.length === 0) {
    return false;
  }

  const [rule] = await db
    .select({ id: pageAccess.id })
    .from(pageAccess)
    .where(
      and(
        eq(pageAccess.workspaceId, workspaceId),
        inArray(pageAccess.pageId, ancestorIds),
        eq(pageAccess.targetType, "public"),
        eq(pageAccess.targetId, "*"),
      ),
    )
    .limit(1);

  return Boolean(rule);
}

export async function canAccessPage(
  pageId: string,
  userId: string,
  required: Exclude<AccessLevel, "none">,
) {
  return hasAccess(await getEffectivePageAccess(pageId, userId), required);
}

export async function canAccessPageInWorkspace(
  pageId: string,
  workspaceId: string,
  userId: string,
  required: Exclude<AccessLevel, "none">,
) {
  return hasAccess(
    await getEffectivePageAccessInWorkspace(pageId, workspaceId, userId),
    required,
  );
}

export const ACTIVE_ORGANIZATION_MISMATCH_CODE = "ACTIVE_ORGANIZATION_MISMATCH";

export function activeWorkspaceMismatchResponse(
  c: Context<AppBindings>,
  workspaceId: string,
) {
  return c.json(
    {
      code: ACTIVE_ORGANIZATION_MISMATCH_CODE,
      error: "Switch to the page workspace to continue.",
      workspaceId,
    },
    409,
  );
}

export async function rejectActiveWorkspaceMismatch(
  c: Context<AppBindings>,
  pageWorkspaceId: string,
  userId: string,
) {
  const activeWorkspaceId = c.get("session")?.activeWorkspaceId ?? null;

  if (!activeWorkspaceId || activeWorkspaceId === pageWorkspaceId) {
    return null;
  }

  if (!(await getMembership(pageWorkspaceId, userId))) {
    return null;
  }

  return activeWorkspaceMismatchResponse(c, pageWorkspaceId);
}

export async function getAccessiblePageIds(
  workspaceId: string,
  userId: string,
  options: { membershipVerified?: boolean } = {},
) {
  if (!options.membershipVerified) {
    const membership = await getMembership(workspaceId, userId);

    if (!membership) {
      return new Set<string>();
    }
  }

  const [pages, teamRows] = await Promise.all([
    db
      .select({
        createdById: page.createdById,
        id: page.id,
        metadata: page.metadata,
      })
      .from(page)
      .where(
        and(eq(page.workspaceId, workspaceId), isNull(page.deletedAt)),
      ),
    db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .where(eq(teamMember.userId, userId)),
  ]);
  const targetTypes = ["user"];
  const targetIds = [userId, ...teamRows.map((row) => row.teamId)];

  if (teamRows.length > 0) {
    targetTypes.push("team");
  }

  const rules =
    targetIds.length > 0
      ? await db
          .select({ pageId: pageAccess.pageId })
          .from(pageAccess)
          .where(
            and(
              eq(pageAccess.workspaceId, workspaceId),
              inArray(pageAccess.targetType, targetTypes),
              inArray(pageAccess.targetId, targetIds),
            ),
          )
      : [];
  const accessible = new Set<string>();
  const sharedRoots = new Set(rules.map((rule) => rule.pageId));
  const graph = new PageGraph({ pages });

  for (const item of pages) {
    const ancestors = graph.getAncestorIds(item.id);

    if (
      graph.hasOwnedRootAccess(ancestors, userId) ||
      ancestors.some((id) => sharedRoots.has(id))
    ) {
      accessible.add(item.id);
    }
  }

  return accessible;
}

export async function getEffectivePageAccessForUsers(
  pageId: string,
  workspaceId: string,
  userIds: string[],
) {
  const uniqueUserIds = [...new Set(userIds)];
  const accessByUserId = new Map<string, AccessLevel>();

  if (uniqueUserIds.length === 0) {
    return accessByUserId;
  }

  const [pages, teamRows] = await Promise.all([
    db
      .select({
        createdById: page.createdById,
        id: page.id,
        metadata: page.metadata,
      })
      .from(page)
      .where(
        and(eq(page.workspaceId, workspaceId), isNull(page.deletedAt)),
      ),
    db
      .select({
        teamId: teamMember.teamId,
        userId: teamMember.userId,
      })
      .from(teamMember)
      .where(inArray(teamMember.userId, uniqueUserIds)),
  ]);
  const graph = new PageGraph({ pages });
  const ancestorIds = graph.getAncestorIds(pageId);

  if (ancestorIds.length === 0) {
    return accessByUserId;
  }

  const teamIdsByUserId = new Map<string, string[]>();

  for (const row of teamRows) {
    teamIdsByUserId.set(row.userId, [
      ...(teamIdsByUserId.get(row.userId) ?? []),
      row.teamId,
    ]);
  }

  const teamIds = [...new Set(teamRows.map((row) => row.teamId))];
  const targetIds = [...uniqueUserIds, ...teamIds];
  const rules = await db
    .select({
      accessLevel: pageAccess.accessLevel,
      targetId: pageAccess.targetId,
      targetType: pageAccess.targetType,
    })
    .from(pageAccess)
    .where(
      and(
        eq(pageAccess.workspaceId, workspaceId),
        inArray(pageAccess.pageId, ancestorIds),
        inArray(pageAccess.targetType, ["user", "team"]),
        inArray(pageAccess.targetId, targetIds),
      ),
    );
  const accessByTarget = new Map<string, AccessLevel>();

  for (const rule of rules) {
    const key = `${rule.targetType}:${rule.targetId}`;
    const current = accessByTarget.get(key) ?? "none";
    const next = normalizeAccessLevel(rule.accessLevel) ?? "none";

    if (accessRank[next] > accessRank[current]) {
      accessByTarget.set(key, next);
    }
  }

  for (const userId of uniqueUserIds) {
    if (graph.hasOwnedRootAccess(ancestorIds, userId)) {
      accessByUserId.set(userId, "full");
      continue;
    }

    const targetKeys = [
      `user:${userId}`,
      ...(teamIdsByUserId.get(userId) ?? []).map((teamId) => `team:${teamId}`),
    ];
    const access = targetKeys.reduce<AccessLevel>((best, key) => {
      const next = accessByTarget.get(key) ?? "none";

      return accessRank[next] > accessRank[best] ? next : best;
    }, "none");

    accessByUserId.set(userId, access);
  }

  return accessByUserId;
}
