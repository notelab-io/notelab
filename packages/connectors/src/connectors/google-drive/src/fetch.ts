export type GoogleDriveFetch = typeof fetch;

export function resolveFetch(fetchImpl?: GoogleDriveFetch): GoogleDriveFetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch === "function") {
    return fetch;
  }

  throw new Error("A fetch implementation is required.");
}
