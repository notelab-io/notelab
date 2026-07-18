import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";

import { appErrorHandler, createApp } from "./app";
import type { AppBindings } from "./types";

test("createApp registers every public feature route group", () => {
  const routes = createApp().routes.map(({ method, path }) => `${method} ${path}`);

  for (const expected of [
    "GET /health",
    "POST /api/ai/chat",
    "POST /api/keys",
    "GET /databases/:id",
    "POST /images/uploads",
    "GET /metadata/bookmark",
    "GET /pages",
    "GET /search",
    "GET /session",
    "GET /workspaces/:workspaceId/access-targets",
  ]) {
    assert.ok(routes.includes(expected), `missing route: ${expected}`);
  }
});

test("createApp keeps global middleware ahead of feature routes", () => {
  const routes = createApp().routes;
  const firstFeatureRoute = routes.findIndex(({ path }) => path !== "/*");

  assert.equal(firstFeatureRoute, 3);
  assert.deepEqual(
    routes.slice(0, firstFeatureRoute).map(({ path }) => path),
    ["/*", "/*", "/*"],
  );
});

test("database availability failures use the stable 503 contract", async () => {
  const app = new Hono<AppBindings>();
  app.use("*", async (c, next) => {
    c.set("requestId", "request-1");
    await next();
  });
  app.get("/database", () => {
    throw Object.assign(new Error("connection details must stay private"), {
      code: "53300",
    });
  });
  app.onError(appErrorHandler);

  const response = await app.request("/database");

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "5");
  assert.deepEqual(await response.json(), {
    code: "DATABASE_UNAVAILABLE",
    message: "The database is temporarily unavailable.",
  });
});
