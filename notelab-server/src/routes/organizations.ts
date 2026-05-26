import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { getMembership } from "../access";
import { db } from "../db";
import { member, team, user } from "../db/schema";
import type { AppBindings } from "../types";

export const organizationRoutes = new Hono<AppBindings>();

const requireUser = (c: Context<AppBindings>) => c.get("user") ?? null;

organizationRoutes.get("/:organizationId/access-targets", async (c) => {
  const requestUser = requireUser(c);

  if (!requestUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const organizationId = c.req.param("organizationId");

  if (!(await getMembership(organizationId, requestUser.id))) {
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
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(user.name), asc(user.email)),
    db
      .select({
        id: team.id,
        name: team.name,
      })
      .from(team)
      .where(eq(team.organizationId, organizationId))
      .orderBy(asc(team.name)),
  ]);

  return c.json({ members, teams });
});
