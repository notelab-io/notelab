"use client";

import { useState, type ReactNode } from "react";

const githubIconSrc = "/icons/github.svg";

export type GithubToolName =
  | "getGithubContent"
  | "getGithubIssue"
  | "getGithubProfile"
  | "getGithubPullRequest"
  | "getGithubRepository"
  | "listGithubCommits"
  | "listGithubIssues"
  | "listGithubPullRequests"
  | "listGithubRepositories";

type GithubUserSummary = {
  avatarUrl?: string;
  email?: string | null;
  htmlUrl?: string;
  id: number;
  login: string;
  name?: string | null;
  type?: string;
};

type GithubRepositorySummary = {
  archived?: boolean;
  defaultBranch?: string;
  description?: string | null;
  fork?: boolean;
  fullName: string;
  htmlUrl: string;
  id: number;
  language?: string | null;
  name: string;
  openIssuesCount?: number;
  owner?: GithubUserSummary;
  private?: boolean;
  pushedAt?: string | null;
  stargazersCount?: number;
  updatedAt?: string;
};

type GithubIssueSummary = {
  assignees?: GithubUserSummary[];
  body?: string | null;
  comments?: number;
  createdAt: string;
  htmlUrl: string;
  labels?: Array<{ color?: string; name: string }>;
  number: number;
  state: string;
  title: string;
  updatedAt: string;
  user?: GithubUserSummary | null;
};

type GithubPullRequestSummary = GithubIssueSummary & {
  additions?: number;
  baseRef?: string;
  changedFiles?: number;
  commits?: number;
  deletions?: number;
  draft?: boolean;
  headRef?: string;
  merged?: boolean;
  mergeable?: boolean | null;
  reviewComments?: number;
};

type GithubCommitSummary = {
  author?: GithubUserSummary | null;
  authorDate?: string;
  authorEmail?: string;
  authorName?: string;
  htmlUrl: string;
  message: string;
  sha: string;
};

type GithubContentSummary = {
  contentText?: string;
  downloadUrl?: string | null;
  encoding?: string;
  entries?: Array<Pick<GithubContentSummary, "htmlUrl" | "name" | "path" | "size" | "type">>;
  htmlUrl?: string;
  isContentTruncated?: boolean;
  name?: string;
  path?: string;
  sha?: string;
  size?: number;
  type?: string;
};

export type GithubToolOutputProps = {
  className?: string;
  output: unknown;
  toolName: GithubToolName;
};

export function GithubToolOutput({
  className,
  output,
  toolName,
}: GithubToolOutputProps) {
  if (toolName === "listGithubRepositories") {
    return (
      <GithubRepositories
        className={className}
        output={output as { repositories?: GithubRepositorySummary[] }}
      />
    );
  }

  if (toolName === "getGithubRepository") {
    return (
      <GithubRepositoryDetail
        className={className}
        repository={output as GithubRepositorySummary}
      />
    );
  }

  if (toolName === "listGithubIssues" || toolName === "getGithubIssue") {
    return (
      <GithubIssues
        className={className}
        output={
          toolName === "getGithubIssue"
            ? { issues: [output as GithubIssueSummary] }
            : (output as { issues?: GithubIssueSummary[] })
        }
        title={toolName === "getGithubIssue" ? "Issue detail" : "Matching issues"}
      />
    );
  }

  if (toolName === "listGithubPullRequests" || toolName === "getGithubPullRequest") {
    return (
      <GithubPullRequests
        className={className}
        output={
          toolName === "getGithubPullRequest"
            ? { pullRequests: [output as GithubPullRequestSummary] }
            : (output as { pullRequests?: GithubPullRequestSummary[] })
        }
        title={toolName === "getGithubPullRequest" ? "Pull request detail" : "Pull requests"}
      />
    );
  }

  if (toolName === "listGithubCommits") {
    return (
      <GithubCommits
        className={className}
        output={output as { commits?: GithubCommitSummary[] }}
      />
    );
  }

  if (toolName === "getGithubContent") {
    return <GithubContent className={className} output={output as GithubContentSummary} />;
  }

  if (toolName === "getGithubProfile") {
    return <GithubProfile className={className} output={output as GithubUserSummary} />;
  }

  return null;
}

export function isGithubToolName(toolName: string): toolName is GithubToolName {
  return (
    toolName === "getGithubContent" ||
    toolName === "getGithubIssue" ||
    toolName === "getGithubProfile" ||
    toolName === "getGithubPullRequest" ||
    toolName === "getGithubRepository" ||
    toolName === "listGithubCommits" ||
    toolName === "listGithubIssues" ||
    toolName === "listGithubPullRequests" ||
    toolName === "listGithubRepositories"
  );
}

function GithubRepositories({
  className,
  output,
}: {
  className?: string;
  output: { repositories?: GithubRepositorySummary[] };
}) {
  const repositories = output.repositories ?? [];

  return (
    <SourcePanel
      className={className}
      kicker="GitHub repositories"
      summary={
        repositories.length
          ? `${repositories.length} repositories shown`
          : "No repositories returned from GitHub"
      }
      title="Repositories"
    >
      {repositories.map((repository) => (
        <RepositoryRow key={repository.id} repository={repository} />
      ))}
    </SourcePanel>
  );
}

function GithubRepositoryDetail({
  className,
  repository,
}: {
  className?: string;
  repository: GithubRepositorySummary;
}) {
  return (
    <SourcePanel
      className={className}
      kicker="GitHub repository"
      summary={repository.description ?? repository.fullName}
      title={repository.fullName}
    >
      <MetadataRow
        items={[
          repository.private ? "Private" : "Public",
          repository.language,
          repository.defaultBranch ? `Default: ${repository.defaultBranch}` : undefined,
          repository.openIssuesCount !== undefined
            ? `${repository.openIssuesCount} open issues`
            : undefined,
          repository.updatedAt ? `Updated ${formatDate(repository.updatedAt)}` : undefined,
        ]}
      />
    </SourcePanel>
  );
}

function GithubIssues({
  className,
  output,
  title,
}: {
  className?: string;
  output: { issues?: GithubIssueSummary[] };
  title: string;
}) {
  const issues = output.issues ?? [];

  return (
    <SourcePanel
      className={className}
      kicker="GitHub issues"
      summary={issues.length ? `${issues.length} issues shown` : "No issues returned"}
      title={title}
    >
      {issues.map((issue) => (
        <IssueRow issue={issue} key={issue.number} />
      ))}
    </SourcePanel>
  );
}

function GithubPullRequests({
  className,
  output,
  title,
}: {
  className?: string;
  output: { pullRequests?: GithubPullRequestSummary[] };
  title: string;
}) {
  const pullRequests = output.pullRequests ?? [];

  return (
    <SourcePanel
      className={className}
      kicker="GitHub pull requests"
      summary={
        pullRequests.length
          ? `${pullRequests.length} pull requests shown`
          : "No pull requests returned"
      }
      title={title}
    >
      {pullRequests.map((pullRequest) => (
        <IssueRow issue={pullRequest} key={pullRequest.number} />
      ))}
    </SourcePanel>
  );
}

function GithubCommits({
  className,
  output,
}: {
  className?: string;
  output: { commits?: GithubCommitSummary[] };
}) {
  const commits = output.commits ?? [];

  return (
    <SourcePanel
      className={className}
      kicker="GitHub commits"
      summary={commits.length ? `${commits.length} commits shown` : "No commits returned"}
      title="Recent commits"
    >
      {commits.map((commit) => (
        <div className="rounded-md border border-border/70 bg-background/70 p-3" key={commit.sha}>
          <a className="font-medium text-sm hover:underline" href={commit.htmlUrl}>
            {commit.message.split("\n")[0] || commit.sha.slice(0, 7)}
          </a>
          <MetadataRow
            items={[
              commit.sha.slice(0, 7),
              commit.author?.login ?? commit.authorName,
              commit.authorDate ? formatDate(commit.authorDate) : undefined,
            ]}
          />
        </div>
      ))}
    </SourcePanel>
  );
}

function GithubContent({
  className,
  output,
}: {
  className?: string;
  output: GithubContentSummary;
}) {
  return (
    <SourcePanel
      className={className}
      kicker="GitHub content"
      summary={output.path ?? output.name ?? "Repository content"}
      title={output.name ?? "Repository content"}
    >
      {output.entries?.map((entry) => (
        <div className="flex items-center justify-between gap-3 text-sm" key={entry.path}>
          <a className="font-medium hover:underline" href={entry.htmlUrl}>
            {entry.path}
          </a>
          <span className="text-muted-foreground">{entry.type}</span>
        </div>
      ))}
      {output.contentText ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-xs">
          {output.contentText}
        </pre>
      ) : null}
      {output.isContentTruncated ? (
        <p className="text-muted-foreground text-xs">File content was truncated.</p>
      ) : null}
    </SourcePanel>
  );
}

function GithubProfile({
  className,
  output,
}: {
  className?: string;
  output: GithubUserSummary;
}) {
  return (
    <SourcePanel
      className={className}
      kicker="GitHub profile"
      summary={output.email ?? output.type}
      title={output.name ?? output.login}
    >
      <MetadataRow items={[output.login, output.type, output.email ?? undefined]} />
    </SourcePanel>
  );
}

function RepositoryRow({ repository }: { repository: GithubRepositorySummary }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 p-3">
      <a className="font-medium text-sm hover:underline" href={repository.htmlUrl}>
        {repository.fullName}
      </a>
      {repository.description ? (
        <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
          {repository.description}
        </p>
      ) : null}
      <MetadataRow
        items={[
          repository.private ? "Private" : "Public",
          repository.language,
          repository.openIssuesCount !== undefined
            ? `${repository.openIssuesCount} open issues`
            : undefined,
          repository.updatedAt ? formatDate(repository.updatedAt) : undefined,
        ]}
      />
    </div>
  );
}

function IssueRow({ issue }: { issue: GithubIssueSummary }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 p-3">
      <a className="font-medium text-sm hover:underline" href={issue.htmlUrl}>
        #{issue.number} {issue.title}
      </a>
      {issue.body ? (
        <p className="mt-1 line-clamp-3 text-muted-foreground text-xs">{issue.body}</p>
      ) : null}
      <MetadataRow
        items={[
          issue.state,
          issue.user?.login,
          issue.comments !== undefined ? `${issue.comments} comments` : undefined,
          formatDate(issue.updatedAt),
        ]}
      />
    </div>
  );
}

function SourcePanel({
  children,
  className,
  kicker,
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  kicker: string;
  summary?: string | null;
  title: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={["rounded-lg border border-border bg-card text-card-foreground shadow-sm", className].filter(Boolean).join(" ")}>
      <button
        aria-expanded={isExpanded}
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setIsExpanded((value) => !value)}
        type="button"
      >
        <img alt="" aria-hidden="true" className="mt-0.5 size-4 shrink-0" src={githubIconSrc} />
        <span className="min-w-0 flex-1">
          <span className="block text-muted-foreground text-xs">{kicker}</span>
          <span className="block truncate font-medium text-sm">{title}</span>
          {summary ? (
            <span className="mt-0.5 block truncate text-muted-foreground text-xs">{summary}</span>
          ) : null}
        </span>
      </button>
      {isExpanded ? <div className="space-y-2 border-t border-border/70 p-3">{children}</div> : null}
    </div>
  );
}

function MetadataRow({ items }: { items: Array<string | null | undefined> }) {
  const values = items.filter((item): item is string => Boolean(item));

  if (!values.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-xs">
      {values.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
