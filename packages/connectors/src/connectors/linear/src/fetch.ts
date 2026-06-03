export type LinearFetch = typeof fetch;

export function resolveFetch(fetchImpl?: LinearFetch): LinearFetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch !== "undefined") {
    return fetch;
  }

  throw new Error("No fetch implementation is available.");
}
