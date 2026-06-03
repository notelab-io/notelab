import { GITHUB_API_BASE_URL } from "./constants.js";
import { GithubConnectorError } from "./errors.js";
import { resolveFetch, type GithubFetch } from "./fetch.js";
import type {
  GithubCommit,
  GithubContent,
  GithubIssue,
  GithubPullRequest,
  GithubRepository,
  GithubUser,
} from "./types.js";

export type GithubClientOptions = {
  accessToken: string;
  baseUrl?: string;
  fetch?: GithubFetch;
};

export type ListGithubRepositoriesOptions = {
  affiliation?: string;
  direction?: "asc" | "desc";
  page?: number;
  perPage?: number;
  sort?: "created" | "full_name" | "pushed" | "updated";
  type?: "all" | "owner" | "public" | "private" | "member";
  visibility?: "all" | "public" | "private";
};

export type GithubRepositoryRef = {
  owner: string;
  repo: string;
};

export type ListGithubIssuesOptions = GithubRepositoryRef & {
  direction?: "asc" | "desc";
  labels?: string[];
  page?: number;
  perPage?: number;
  since?: string;
  sort?: "created" | "comments" | "updated";
  state?: "all" | "closed" | "open";
};

export type ListGithubPullRequestsOptions = GithubRepositoryRef & {
  base?: string;
  direction?: "asc" | "desc";
  head?: string;
  page?: number;
  perPage?: number;
  sort?: "created" | "long-running" | "popularity" | "updated";
  state?: "all" | "closed" | "open";
};

export type ListGithubCommitsOptions = GithubRepositoryRef & {
  author?: string;
  page?: number;
  path?: string;
  perPage?: number;
  sha?: string;
  since?: string;
  until?: string;
};

export type GetGithubContentOptions = GithubRepositoryRef & {
  path: string;
  ref?: string;
};

export class GithubReadonlyClient {
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #fetch: GithubFetch;

  constructor({
    accessToken,
    baseUrl = GITHUB_API_BASE_URL,
    fetch: fetchImpl,
  }: GithubClientOptions) {
    this.#accessToken = accessToken;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = resolveFetch(fetchImpl);
  }

  getViewer() {
    return this.#request<GithubUser>("user");
  }

  listRepositories(options: ListGithubRepositoriesOptions = {}) {
    const search = new URLSearchParams();
    setOptional(search, "affiliation", options.affiliation);
    setOptional(search, "direction", options.direction);
    setOptional(search, "page", options.page);
    setOptional(search, "per_page", options.perPage);
    setOptional(search, "sort", options.sort);
    setOptional(search, "type", options.type);
    setOptional(search, "visibility", options.visibility);

    return this.#request<GithubRepository[]>(`user/repos${toQueryString(search)}`);
  }

  getRepository({ owner, repo }: GithubRepositoryRef) {
    return this.#request<GithubRepository>(
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );
  }

  listIssues(options: ListGithubIssuesOptions) {
    const search = new URLSearchParams();
    setOptional(search, "direction", options.direction);
    setOptional(search, "labels", options.labels?.join(","));
    setOptional(search, "page", options.page);
    setOptional(search, "per_page", options.perPage);
    setOptional(search, "since", options.since);
    setOptional(search, "sort", options.sort);
    setOptional(search, "state", options.state);

    return this.#request<GithubIssue[]>(
      `repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/issues${toQueryString(search)}`,
    );
  }

  getIssue({ owner, repo, issueNumber }: GithubRepositoryRef & { issueNumber: number }) {
    return this.#request<GithubIssue>(
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/issues/${issueNumber}`,
    );
  }

  listPullRequests(options: ListGithubPullRequestsOptions) {
    const search = new URLSearchParams();
    setOptional(search, "base", options.base);
    setOptional(search, "direction", options.direction);
    setOptional(search, "head", options.head);
    setOptional(search, "page", options.page);
    setOptional(search, "per_page", options.perPage);
    setOptional(search, "sort", options.sort);
    setOptional(search, "state", options.state);

    return this.#request<GithubPullRequest[]>(
      `repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/pulls${toQueryString(search)}`,
    );
  }

  getPullRequest({
    owner,
    pullNumber,
    repo,
  }: GithubRepositoryRef & { pullNumber: number }) {
    return this.#request<GithubPullRequest>(
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/pulls/${pullNumber}`,
    );
  }

  listCommits(options: ListGithubCommitsOptions) {
    const search = new URLSearchParams();
    setOptional(search, "author", options.author);
    setOptional(search, "page", options.page);
    setOptional(search, "path", options.path);
    setOptional(search, "per_page", options.perPage);
    setOptional(search, "sha", options.sha);
    setOptional(search, "since", options.since);
    setOptional(search, "until", options.until);

    return this.#request<GithubCommit[]>(
      `repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/commits${toQueryString(search)}`,
    );
  }

  getContent(options: GetGithubContentOptions) {
    const search = new URLSearchParams();
    setOptional(search, "ref", options.ref);

    return this.#request<GithubContent | GithubContent[]>(
      `repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/contents/${encodePath(options.path)}${toQueryString(search)}`,
    );
  }

  async #request<T>(path: string): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}/${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.#accessToken}`,
        "user-agent": "notelab-github-connector",
        "x-github-api-version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new GithubConnectorError("GitHub API request failed.", {
        code: "GITHUB_API_REQUEST_FAILED",
        status: response.status,
      });
    }

    return response.json() as Promise<T>;
  }
}

function setOptional(
  search: URLSearchParams,
  key: string,
  value: number | string | undefined,
) {
  if (value !== undefined && value !== "") {
    search.set(key, String(value));
  }
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function toQueryString(search: URLSearchParams) {
  const value = search.toString();
  return value ? `?${value}` : "";
}
