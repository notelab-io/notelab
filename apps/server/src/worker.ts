import type { AppBindings } from "./types";
import { routeAgentRequest } from "agents";
import { ChatAgent } from "./ai/chat-agent";
import {
  getAiChatThreadForUser,
  parseAiChatAgentInstanceName,
} from "./ai/chat-persistence";
import { isLocalDevelopmentHost, isAllowedClientOrigin } from "./config";
import { createAuth } from "./auth";
import { getMembership } from "./access";
import { createDbClient, runWithDbClient } from "./db";
export { ChatAgent } from "./ai/chat-agent";

type WorkerEnv = AppBindings["Bindings"] & Record<string, unknown>;
type App = Awaited<ReturnType<typeof loadApp>>;

let appPromise: Promise<App> | null = null;

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    appPromise ??= loadApp();
    const appResponse = await routeAgentRequest(request, env, {
      cors: getAgentCorsHeaders(env, request),
      onBeforeConnect: (req, lobby) => authorizeAgentRequest(req, lobby, env),
      onBeforeRequest: (req, lobby) => authenticateAgentRequest(req, lobby, env),
    });

    if (appResponse) {
      return appResponse;
    }

    return (await appPromise).fetch(request, env, ctx as never);
  },
};

async function authenticateAgentRequest(request: Request, _lobby: unknown, env: WorkerEnv) {
  const authResult = await getAgentAuthContext(request, env);

  if (authResult instanceof Response) {
    return authResult;
  }
}

async function authorizeAgentRequest(request: Request, _lobby: unknown, env: WorkerEnv) {
  const authResult = await getAgentAuthContext(request, env);

  if (authResult instanceof Response) {
    return authResult;
  }

  const { session, workspaceId } = authResult;
  const instance = readAgentInstanceName(request);
  if (!instance) {
    return new Response("Invalid agent instance.", { status: 404 });
  }

  const userId = session?.user?.id;

  if (!workspaceId || !userId) {
    return;
  }

  const parsedInstance = parseAiChatAgentInstanceName(instance);

  if (
    !parsedInstance ||
    parsedInstance.workspaceId !== workspaceId ||
    parsedInstance.userId !== userId
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const thread = await runWithDbClient(createDbClient(env), () =>
    getAiChatThreadForUser({
      workspaceId,
      threadId: parsedInstance.threadId,
      userId,
    }),
  );

  if (!thread) {
    return new Response("Forbidden", { status: 403 });
  }
}

async function getAgentAuthContext(request: Request, env: WorkerEnv) {
  const db = createDbClient(env);
  return runWithDbClient(db, async () => {
    const authHeaders = getAuthHeaders(request.headers);
    const auth = createAuth(env, request);
    const session = await auth.api.getSession({ headers: authHeaders });
    const workspaceId =
      readAgentWorkspaceId(request) ??
      request.headers.get("x-notelab-workspace-id")?.trim() ??
      null;

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!workspaceId) {
      return new Response("Missing workspace", { status: 409 });
    }

    if (!(await getMembership(workspaceId, session.user.id))) {
      return new Response("Forbidden", { status: 403 });
    }

    return { session, workspaceId };
  });
}

function getAuthHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  const mobileAuthCookie = nextHeaders.get("x-mobile-auth-cookie")?.trim();

  if (!nextHeaders.has("cookie") && mobileAuthCookie) {
    nextHeaders.set("cookie", mobileAuthCookie);
  }

  return nextHeaders;
}

function getAgentCorsHeaders(env: WorkerEnv, request: Request) {
  const headers = new Headers();
  const origin = request.headers.get("origin");

  if (!origin || isAgentOriginAllowed(env, origin)) {
    headers.set("Access-Control-Allow-Origin", origin ?? "*");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Allow-Headers",
      "authorization, content-type, x-mobile-auth-cookie, x-notelab-workspace-id",
    );
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Vary", "Origin");
  }

  return Object.fromEntries(headers.entries());
}

function isAgentOriginAllowed(env: WorkerEnv, origin: string) {
  return (
    isAllowedClientOrigin(env, origin) || isLocalDevelopmentHost(getOriginHost(origin))
  );
}

function getOriginHost(origin: string) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function readAgentInstanceName(request: Request) {
  const parts = new URL(request.url).pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/");

  return parts.length >= 3 && parts[0] === "agents" ? parts[2] : null;
}

function readAgentWorkspaceId(request: Request) {
  return new URL(request.url).searchParams.get("workspaceId")?.trim() ?? null;
}

async function loadApp() {
  const { createApp } = await import("./app");

  return createApp();
}
