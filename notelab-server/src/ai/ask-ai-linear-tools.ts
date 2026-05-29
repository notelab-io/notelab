import { LinearReadonlyClient } from "../../../notelab-client/src/connectors/linear/src/index.js";
import { tool, type ToolSet } from "ai";
import * as z from "zod";

import { truncateText } from "./ask-ai-utils";

type LinearIssueLike = {
  assignee?: Promise<LinearUserLike> | undefined;
  assigneeId?: string;
  completedAt?: Date | null;
  createdAt: Date;
  description?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  id: string;
  identifier: string;
  priority: number;
  priorityLabel: string;
  projectId?: string;
  state?: Promise<LinearWorkflowStateLike> | undefined;
  stateId?: string;
  team?: Promise<LinearTeamLike> | undefined;
  teamId?: string;
  title: string;
  updatedAt: Date;
  url: string;
};

type LinearProjectLike = {
  completedAt?: Date | null;
  content?: string | null;
  createdAt: Date;
  description?: string | null;
  health?: string | null;
  id: string;
  name: string;
  priorityLabel?: string;
  progress: number;
  slugId: string;
  startDate?: string | null;
  state?: string;
  targetDate?: string | null;
  updatedAt: Date;
  url: string;
};

type LinearTeamLike = {
  description?: string | null;
  displayName: string;
  id: string;
  issueCount: number;
  key: string;
  name: string;
  private: boolean;
};

type LinearUserLike = {
  displayName?: string;
  email?: string;
  id: string;
  name?: string;
};

type LinearWorkflowStateLike = {
  id: string;
  name: string;
  type: string;
};

export function buildLinearTools(accessToken: string): ToolSet {
  const linear = new LinearReadonlyClient({ accessToken });

  return {
    getLinearProfile: tool({
      description:
        "Read the connected Linear workspace and user profile for the organization integration.",
      inputSchema: z.object({}),
      execute: async () => {
        const [organization, viewer] = await Promise.all([
          linear.getOrganization(),
          linear.getViewer(),
        ]);

        return { organization, viewer };
      },
    }),
    listLinearTeams: tool({
      description:
        "List Linear teams visible to the connected organization integration. Use this to find team ids or keys before narrowing issue searches.",
      inputSchema: z.object({
        cursor: z.string().trim().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ cursor, limit }) => {
        const variables = {
          after: cursor,
          first: limit,
        } as Parameters<typeof linear.client.teams>[0];
        const results = await linear.client.teams(variables);

        return {
          nextCursor: results.pageInfo.endCursor,
          hasNextPage: results.pageInfo.hasNextPage,
          teams: results.nodes.map(toLinearTeamSummary),
        };
      },
    }),
    listLinearProjects: tool({
      description:
        "List Linear projects visible to the connected organization integration.",
      inputSchema: z.object({
        cursor: z.string().trim().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ cursor, limit }) => {
        const variables = {
          after: cursor,
          first: limit,
        } as Parameters<typeof linear.client.projects>[0];
        const results = await linear.client.projects(variables);

        return {
          nextCursor: results.pageInfo.endCursor,
          hasNextPage: results.pageInfo.hasNextPage,
          projects: results.nodes.map(toLinearProjectSummary),
        };
      },
    }),
    searchLinearIssues: tool({
      description:
        "Search Linear issues by natural-language text. Use this for bugs, project work, blockers, ticket identifiers, statuses, assignees, and issue descriptions.",
      inputSchema: z.object({
        cursor: z.string().trim().optional(),
        includeArchived: z.boolean().default(false),
        limit: z.number().int().min(1).max(20).default(10),
        query: z.string().trim().min(1),
      }),
      execute: async ({ cursor, includeArchived, limit, query }) => {
        const variables = {
          after: cursor,
          first: limit,
          includeArchived,
        } as Parameters<typeof linear.client.searchIssues>[1];
        const results = await linear.client.searchIssues(query, variables);

        return {
          nextCursor: results.pageInfo.endCursor,
          hasNextPage: results.pageInfo.hasNextPage,
          totalCount: results.totalCount,
          issues: await Promise.all(
            results.nodes.map((issue) => toHydratedLinearIssueSummary(linear, issue)),
          ),
        };
      },
    }),
    listLinearIssues: tool({
      description:
        "List recent Linear issues visible to the connected organization integration. Prefer searchLinearIssues when the user gives a topic or keyword.",
      inputSchema: z.object({
        cursor: z.string().trim().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ cursor, limit }) => {
        const variables = {
          after: cursor,
          first: limit,
        } as Parameters<typeof linear.client.issues>[0];
        const results = await linear.client.issues(variables);

        return {
          nextCursor: results.pageInfo.endCursor,
          hasNextPage: results.pageInfo.hasNextPage,
          issues: await Promise.all(results.nodes.map(toLinearIssueSummary)),
        };
      },
    }),
    getLinearIssue: tool({
      description:
        "Read one Linear issue by UUID, URL slug, or human-readable identifier such as ENG-123.",
      inputSchema: z.object({
        issueId: z.string().trim().min(1),
      }),
      execute: async ({ issueId }) => {
        const issue = await linear.client.issue(issueId);

        return toLinearIssueSummary(issue, 6000);
      },
    }),
    getLinearIssueComments: tool({
      description:
        "Read comments on a Linear issue by UUID, URL slug, or human-readable identifier such as ENG-123.",
      inputSchema: z.object({
        cursor: z.string().trim().optional(),
        issueId: z.string().trim().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ cursor, issueId, limit }) => {
        const issue = await linear.client.issue(issueId);
        const variables = {
          after: cursor,
          first: limit,
        } as Parameters<typeof issue.comments>[0];
        const comments = await issue.comments(variables);

        return {
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
          },
          nextCursor: comments.pageInfo.endCursor,
          hasNextPage: comments.pageInfo.hasNextPage,
          comments: await Promise.all(
            comments.nodes.map(async (comment) => {
              const user = await optionalFetch(comment.user);

              return {
                body: truncateText(comment.body, 3000),
                createdAt: toIso(comment.createdAt),
                editedAt: toIso(comment.editedAt),
                id: comment.id,
                parentId: comment.parentId,
                resolvedAt: toIso(comment.resolvedAt),
                updatedAt: toIso(comment.updatedAt),
                url: comment.url,
                user: user ? toLinearUserSummary(user) : undefined,
                userId: comment.userId,
              };
            }),
          ),
        };
      },
    }),
  };
}

async function toLinearIssueSummary(
  issue: LinearIssueLike,
  maxDescriptionLength = 2500,
) {
  const [assignee, state, team] = await Promise.all([
    optionalFetch(issue.assignee),
    optionalFetch(issue.state),
    optionalFetch(issue.team),
  ]);

  return {
    assignee: assignee ? toLinearUserSummary(assignee) : undefined,
    assigneeId: issue.assigneeId,
    completedAt: toIso(issue.completedAt),
    createdAt: toIso(issue.createdAt),
    description: truncateText(issue.description ?? undefined, maxDescriptionLength),
    dueDate: issue.dueDate,
    estimate: issue.estimate,
    id: issue.id,
    identifier: issue.identifier,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    projectId: issue.projectId,
    state: state ? toLinearWorkflowStateSummary(state) : undefined,
    stateId: issue.stateId,
    team: team ? toLinearTeamSummary(team) : undefined,
    teamId: issue.teamId,
    title: issue.title,
    updatedAt: toIso(issue.updatedAt),
    url: issue.url,
  };
}

async function toHydratedLinearIssueSummary(
  linear: LinearReadonlyClient,
  issue: LinearIssueLike,
) {
  try {
    const fullIssue = await linear.client.issue(issue.id);
    return toLinearIssueSummary(fullIssue);
  } catch {
    return toLinearIssueSummary(issue);
  }
}

function toLinearProjectSummary(project: LinearProjectLike) {
  return {
    completedAt: toIso(project.completedAt),
    content: truncateText(project.content ?? undefined, 2500),
    createdAt: toIso(project.createdAt),
    description: truncateText(project.description ?? undefined, 1000),
    health: project.health,
    id: project.id,
    name: project.name,
    priorityLabel: project.priorityLabel,
    progress: project.progress,
    slugId: project.slugId,
    startDate: project.startDate,
    state: project.state,
    targetDate: project.targetDate,
    updatedAt: toIso(project.updatedAt),
    url: project.url,
  };
}

function toLinearTeamSummary(team: LinearTeamLike) {
  return {
    description: truncateText(team.description ?? undefined, 1000),
    displayName: team.displayName,
    id: team.id,
    issueCount: team.issueCount,
    key: team.key,
    name: team.name,
    private: team.private,
  };
}

function toLinearUserSummary(user: LinearUserLike) {
  return {
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    name: user.name,
  };
}

function toLinearWorkflowStateSummary(state: LinearWorkflowStateLike) {
  return {
    id: state.id,
    name: state.name,
    type: state.type,
  };
}

async function optionalFetch<T>(value: Promise<T> | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return await value;
  } catch {
    return undefined;
  }
}

function toIso(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}
