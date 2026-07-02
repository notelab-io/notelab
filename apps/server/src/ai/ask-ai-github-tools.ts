import {
  GithubReadonlyClient,
  type GithubCommit,
  type GithubContent,
  type GithubIssue,
  type GithubPullRequest,
  type GithubRepository,
  type GithubUser,
} from "@notelab/connectors/github";
import { tool, type ToolSet } from "ai";
import * as z from "zod";

import { truncateText } from "./ask-ai-utils";

const repoRefSchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

export function buildGithubTools(accessToken: string): ToolSet {
  const github = new GithubReadonlyClient({
    accessToken,
    fetch: (input, init) => fetch(input, init),
  });

  return {
    getGithubProfile: tool({
      description:
        "Read the connected GitHub user profile for the workspace integration.",
      inputSchema: z.object({}),
      execute: async () => toGithubUserSummary(await github.getViewer()),
    }),
    listGithubRepositories: tool({
      description:
        "List GitHub repositories visible to the connected integration. Use this to find owner and repo names before reading issues, pull requests, commits, or files.",
      inputSchema: z.object({
        affiliation: z.string().trim().default("owner,collaborator,workspace_member"),
        direction: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(50).default(20),
        sort: z.enum(["created", "full_name", "pushed", "updated"]).default("updated"),
        visibility: z.enum(["all", "public", "private"]).default("all"),
      }),
      execute: async ({
        affiliation,
        direction,
        page,
        perPage,
        sort,
        visibility,
      }) => ({
        repositories: (
          await github.listRepositories({
            affiliation,
            direction,
            page,
            perPage,
            sort,
            visibility,
          })
        ).map(toGithubRepositorySummary),
      }),
    }),
    getGithubRepository: tool({
      description:
        "Read metadata for one GitHub repository by owner and repo name.",
      inputSchema: repoRefSchema,
      execute: async ({ owner, repo }) =>
        toGithubRepositorySummary(await github.getRepository({ owner, repo })),
    }),
    listGithubIssues: tool({
      description:
        "List GitHub issues for a repository. Use this for bugs, feature requests, labels, assignees, open work, blockers, or issue status.",
      inputSchema: repoRefSchema.extend({
        direction: z.enum(["asc", "desc"]).default("desc"),
        labels: z.array(z.string().trim().min(1)).default([]),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(30).default(10),
        since: z
          .string()
          .trim()
          .optional()
          .describe("Optional ISO 8601 timestamp lower bound for updated issues."),
        sort: z.enum(["created", "comments", "updated"]).default("updated"),
        state: z.enum(["all", "closed", "open"]).default("open"),
      }),
      execute: async ({ direction, labels, owner, page, perPage, repo, since, sort, state }) => ({
        issues: (
          await github.listIssues({
            direction,
            labels,
            owner,
            page,
            perPage,
            repo,
            since,
            sort,
            state,
          })
        )
          .filter((issue) => !issue.pull_request)
          .map((issue) => toGithubIssueSummary(issue)),
      }),
    }),
    getGithubIssue: tool({
      description:
        "Read one GitHub issue by owner, repo, and issue number.",
      inputSchema: repoRefSchema.extend({
        issueNumber: z.number().int().min(1),
      }),
      execute: async ({ issueNumber, owner, repo }) =>
        toGithubIssueSummary(
          await github.getIssue({ issueNumber, owner, repo }),
          6000,
        ),
    }),
    listGithubPullRequests: tool({
      description:
        "List GitHub pull requests for a repository. Use this for PR status, review activity, draft state, branches, and delivery progress.",
      inputSchema: repoRefSchema.extend({
        base: z.string().trim().optional(),
        direction: z.enum(["asc", "desc"]).default("desc"),
        head: z.string().trim().optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(30).default(10),
        sort: z.enum(["created", "long-running", "popularity", "updated"]).default("updated"),
        state: z.enum(["all", "closed", "open"]).default("open"),
      }),
      execute: async ({
        base,
        direction,
        head,
        owner,
        page,
        perPage,
        repo,
        sort,
        state,
      }) => ({
        pullRequests: (
          await github.listPullRequests({
            base,
            direction,
            head,
            owner,
            page,
            perPage,
            repo,
            sort,
            state,
          })
        ).map(toGithubPullRequestSummary),
      }),
    }),
    getGithubPullRequest: tool({
      description:
        "Read one GitHub pull request by owner, repo, and pull request number.",
      inputSchema: repoRefSchema.extend({
        pullNumber: z.number().int().min(1),
      }),
      execute: async ({ owner, pullNumber, repo }) =>
        toGithubPullRequestSummary(
          await github.getPullRequest({ owner, pullNumber, repo }),
          6000,
        ),
    }),
    listGithubCommits: tool({
      description:
        "List GitHub commits for a repository, branch, author, path, or time window.",
      inputSchema: repoRefSchema.extend({
        author: z.string().trim().optional(),
        page: z.number().int().min(1).default(1),
        path: z.string().trim().optional(),
        perPage: z.number().int().min(1).max(30).default(10),
        sha: z.string().trim().optional().describe("Branch name or commit SHA."),
        since: z.string().trim().optional().describe("Optional ISO 8601 lower bound."),
        until: z.string().trim().optional().describe("Optional ISO 8601 upper bound."),
      }),
      execute: async ({ author, owner, page, path, perPage, repo, sha, since, until }) => ({
        commits: (
          await github.listCommits({
            author,
            owner,
            page,
            path,
            perPage,
            repo,
            sha,
            since,
            until,
          })
        ).map(toGithubCommitSummary),
      }),
    }),
    getGithubContent: tool({
      description:
        "Read a GitHub repository file or directory listing by path. For text files, decoded content is included.",
      inputSchema: repoRefSchema.extend({
        maxContentLength: z.number().int().min(0).max(50000).default(12000),
        path: z.string().trim().min(1),
        ref: z.string().trim().optional().describe("Optional branch, tag, or commit SHA."),
      }),
      execute: async ({ maxContentLength, owner, path, ref, repo }) =>
        toGithubContentSummary(
          await github.getContent({ owner, path, ref, repo }),
          maxContentLength,
        ),
    }),
  };
}

function toGithubUserSummary(user?: GithubUser | null) {
  return user
    ? {
        avatarUrl: user.avatar_url,
        email: user.email,
        htmlUrl: user.html_url,
        id: user.id,
        login: user.login,
        name: user.name,
        type: user.type,
      }
    : undefined;
}

function toGithubRepositorySummary(repository: GithubRepository) {
  return {
    archived: repository.archived,
    defaultBranch: repository.default_branch,
    description: truncateText(repository.description ?? undefined, 1000),
    fork: repository.fork,
    fullName: repository.full_name,
    htmlUrl: repository.html_url,
    id: repository.id,
    language: repository.language,
    name: repository.name,
    openIssuesCount: repository.open_issues_count,
    owner: toGithubUserSummary(repository.owner),
    private: repository.private,
    pushedAt: repository.pushed_at,
    stargazersCount: repository.stargazers_count,
    updatedAt: repository.updated_at,
  };
}

function toGithubIssueSummary(issue: GithubIssue, maxBodyLength = 2500) {
  return {
    assignees: issue.assignees?.map(toGithubUserSummary),
    body: truncateText(issue.body ?? undefined, maxBodyLength),
    comments: issue.comments,
    createdAt: issue.created_at,
    htmlUrl: issue.html_url,
    labels: issue.labels?.map((label) => ({
      color: label.color,
      name: label.name,
    })),
    number: issue.number,
    state: issue.state,
    title: issue.title,
    updatedAt: issue.updated_at,
    user: toGithubUserSummary(issue.user),
  };
}

function toGithubPullRequestSummary(
  pullRequest: GithubPullRequest,
  maxBodyLength = 2500,
) {
  return {
    additions: pullRequest.additions,
    assignees: pullRequest.assignees?.map(toGithubUserSummary),
    baseRef: pullRequest.base.ref,
    body: truncateText(pullRequest.body ?? undefined, maxBodyLength),
    changedFiles: pullRequest.changed_files,
    comments: pullRequest.comments,
    commits: pullRequest.commits,
    createdAt: pullRequest.created_at,
    deletions: pullRequest.deletions,
    draft: pullRequest.draft,
    headRef: pullRequest.head.ref,
    htmlUrl: pullRequest.html_url,
    mergeable: pullRequest.mergeable,
    merged: pullRequest.merged,
    number: pullRequest.number,
    reviewComments: pullRequest.review_comments,
    state: pullRequest.state,
    title: pullRequest.title,
    updatedAt: pullRequest.updated_at,
    user: toGithubUserSummary(pullRequest.user),
  };
}

function toGithubCommitSummary(commit: GithubCommit) {
  return {
    author: toGithubUserSummary(commit.author),
    authorDate: commit.commit.author?.date,
    authorEmail: commit.commit.author?.email,
    authorName: commit.commit.author?.name,
    htmlUrl: commit.html_url,
    message: truncateText(commit.commit.message, 2000),
    sha: commit.sha,
  };
}

function toGithubContentSummary(
  content: GithubContent | GithubContent[],
  maxContentLength: number,
) {
  if (Array.isArray(content)) {
    return {
      entries: content.map((entry) => ({
        htmlUrl: entry.html_url,
        name: entry.name,
        path: entry.path,
        size: entry.size,
        type: entry.type,
      })),
    };
  }

  const decoded =
    content.encoding === "base64" && content.content
      ? decodeBase64Text(content.content)
      : undefined;
  const contentText = truncateText(decoded, maxContentLength);

  return {
    contentText,
    downloadUrl: content.download_url,
    encoding: content.encoding,
    htmlUrl: content.html_url,
    isContentTruncated:
      Boolean(decoded) &&
      Boolean(contentText) &&
      (contentText?.length ?? 0) < decoded!.length,
    name: content.name,
    path: content.path,
    sha: content.sha,
    size: content.size,
    type: content.type,
  };
}

function decodeBase64Text(value: string) {
  const binary = atob(value.replaceAll(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
