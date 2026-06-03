import type { GITHUB_CONNECTOR_SCOPES } from "./constants.js";

export type GithubConnectorScope =
  | (typeof GITHUB_CONNECTOR_SCOPES)[number]
  | "public_repo"
  | "repo:status"
  | "repo_deployment"
  | "user"
  | string;

export type GithubOAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
};

export type GithubUser = {
  avatar_url?: string;
  email?: string | null;
  html_url: string;
  id: number;
  login: string;
  name?: string | null;
  type?: string;
};

export type GithubRepository = {
  archived?: boolean;
  default_branch?: string;
  description?: string | null;
  fork?: boolean;
  full_name: string;
  html_url: string;
  id: number;
  language?: string | null;
  name: string;
  open_issues_count?: number;
  owner: GithubUser;
  private?: boolean;
  pushed_at?: string | null;
  stargazers_count?: number;
  updated_at?: string;
};

export type GithubIssue = {
  assignee?: GithubUser | null;
  assignees?: GithubUser[];
  body?: string | null;
  comments?: number;
  created_at: string;
  html_url: string;
  id: number;
  labels?: Array<{ color?: string; name: string }>;
  number: number;
  pull_request?: { html_url?: string; url?: string };
  repository_url?: string;
  state: string;
  title: string;
  updated_at: string;
  user?: GithubUser | null;
};

export type GithubPullRequest = {
  additions?: number;
  assignee?: GithubUser | null;
  assignees?: GithubUser[];
  base: { ref: string; repo?: GithubRepository };
  body?: string | null;
  changed_files?: number;
  comments?: number;
  commits?: number;
  created_at: string;
  deletions?: number;
  draft?: boolean;
  head: { ref: string; repo?: GithubRepository; sha: string };
  html_url: string;
  id: number;
  merged?: boolean;
  mergeable?: boolean | null;
  number: number;
  review_comments?: number;
  state: string;
  title: string;
  updated_at: string;
  user?: GithubUser | null;
};

export type GithubCommit = {
  author?: GithubUser | null;
  commit: {
    author?: { date?: string; email?: string; name?: string };
    message: string;
  };
  html_url: string;
  sha: string;
};

export type GithubContent = {
  content?: string;
  download_url?: string | null;
  encoding?: string;
  html_url?: string;
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule" | string;
};
