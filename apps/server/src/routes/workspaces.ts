import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getMembership, isPrivilegedOrgRole } from "../access";
import { rejectMismatchedApiKeyWorkspace } from "../api-keys";
import { db } from "../db";
import { member, workspace, team, user } from "../db/schema";
import type { AppBindings } from "../types";

export const workspaceRoutes = new Hono<AppBindings>();

const requireUser = (c: Context<AppBindings>) => c.get("user") ?? null;
const updateWorkspaceSchema = z
  .object({
    logo: z
      .union([
        z.string().trim().url("Enter a valid logo URL."),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    metadata: z
      .union([z.string().trim().max(5000), z.literal(""), z.null()])
      .optional(),
    name: z.string().trim().min(1, "Workspace name is required.").max(120).optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required.")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.")
      .optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.slug !== undefined ||
      value.logo !== undefined ||
      value.metadata !== undefined,
    "Provide at least one field to update.",
  );

workspaceRoutes.get("/:workspaceId/access-targets", async (c) => {
  const requestUser = requireUser(c);

  if (!requestUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const workspaceId = c.req.param("workspaceId");
  const mismatch = rejectMismatchedApiKeyWorkspace(c, workspaceId);

  if (mismatch) {
    return mismatch;
  }

  if (!(await getMembership(workspaceId, requestUser.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [members, teams] = await Promise.all([
    db
      .select({
        email: user.email,
        id: user.id,
        memberId: member.id,
        name: user.name,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, workspaceId))
      .orderBy(asc(user.name), asc(user.email)),
    db
      .select({
        id: team.id,
        name: team.name,
      })
      .from(team)
      .where(eq(team.organizationId, workspaceId))
      .orderBy(asc(team.name)),
  ]);

  return c.json({ members, teams });
});

workspaceRoutes.patch("/:workspaceId", async (c) => {
  const requestUser = requireUser(c);

  if (!requestUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const workspaceId = c.req.param("workspaceId");
  const mismatch = rejectMismatchedApiKeyWorkspace(c, workspaceId);

  if (mismatch) {
    return mismatch;
  }

  const membership = await getMembership(workspaceId, requestUser.id);

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!isPrivilegedOrgRole(membership.role)) {
    return c.json({ error: "Only workspace admins can update settings." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }

  const nextSlug = parsed.data.slug?.trim().toLowerCase();

  if (nextSlug) {
    const [existingWorkspace] = await db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, nextSlug))
      .limit(1);

    if (existingWorkspace && existingWorkspace.id !== workspaceId) {
      return c.json({ error: "That workspace slug is already in use." }, 409);
    }
  }

  const [updatedWorkspace] = await db
    .update(workspace)
    .set({
      logo:
        parsed.data.logo !== undefined
          ? parsed.data.logo?.trim() || null
          : undefined,
      metadata:
        parsed.data.metadata !== undefined
          ? parsed.data.metadata?.trim() || null
          : undefined,
      name: parsed.data.name?.trim(),
      slug: nextSlug,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, workspaceId))
    .returning();

  if (!updatedWorkspace) {
    return c.json({ error: "Workspace not found." }, 404);
  }

  return c.json(updatedWorkspace);
});
