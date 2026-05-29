export type GithubFetch = typeof fetch;

export function resolveFetch(fetchImpl?: GithubFetch): GithubFetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  return fetch;
}
