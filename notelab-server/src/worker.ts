import type { AppBindings } from "./types";

type WorkerEnv = AppBindings["Bindings"] & Record<string, unknown>;
type App = Awaited<ReturnType<typeof loadApp>>;

let appPromise: Promise<App> | null = null;

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    appPromise ??= loadApp();

    return (await appPromise).fetch(request, env, ctx as never);
  },
};

async function loadApp() {
  const { createApp } = await import("./app");

  return createApp();
}
