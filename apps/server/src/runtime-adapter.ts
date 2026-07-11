import { getRequiredStringEnv, getStringEnv, type RuntimeEnv } from "./config";
import type { ImageStorage } from "./image-storage";

export type ServerRuntimeAdapter = {
  applyPageContentUpdate?(input: {
    content: unknown;
    env: RuntimeEnv;
    pageId: string;
    userId: string;
  }): Promise<void>;
  createImageStorage?(env: RuntimeEnv): ImageStorage | null;
  getCollaborationWebSocketUrl?(request: Request, env: RuntimeEnv): string;
  getDatabaseUrl?(env: RuntimeEnv): string | null | undefined;
  getImageStorageMode?(env: RuntimeEnv): "s3" | "binding" | null | undefined;
  selfHosted?: false;
};

export function getCollaborationWebSocketUrl(
  request: Request,
  env: RuntimeEnv,
) {
  const explicitUrl = getStringEnv(env, "COLLABORATION_WEBSOCKET_URL");

  if (explicitUrl) {
    return explicitUrl;
  }

  const configured = runtimeAdapter.getCollaborationWebSocketUrl?.(request, env);

  if (configured) {
    return configured;
  }

  const url = new URL(request.url);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/collaboration";
  url.search = "";
  url.hash = "";
  return url.toString();
}

let runtimeAdapter: ServerRuntimeAdapter = {};

export function setRuntimeAdapter(adapter: ServerRuntimeAdapter) {
  runtimeAdapter = adapter;
}

export function getDatabaseUrl(env: RuntimeEnv) {
  const adapterUrl = runtimeAdapter.getDatabaseUrl?.(env);

  if (adapterUrl) {
    return adapterUrl;
  }

  return getRequiredStringEnv(env, "DATABASE_URL");
}

export function getRuntimeAdapter() {
  return runtimeAdapter;
}

export function isSelfHostedRuntime() {
  return runtimeAdapter.selfHosted !== false;
}

export function getConfiguredImageStorageMode(env: RuntimeEnv) {
  const configured = getStringEnv(env, "IMAGE_STORAGE_MODE");

  if (!configured) {
    return null;
  }

  if (configured === "s3" || configured === "binding") {
    return configured;
  }

  throw new Error("IMAGE_STORAGE_MODE must be either 's3' or 'binding'");
}
