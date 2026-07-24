import assert from "node:assert/strict";
import test from "node:test";

import {
  getEEAdminRoutes,
  getEEPlugins,
  initEdition,
  resetEditionForTests,
} from "./edition";

test("initEdition is a no-op for Community (no ZILOBASE_EDITION)", async () => {
  resetEditionForTests();
  delete process.env.ZILOBASE_EDITION;

  await initEdition();

  assert.deepEqual(getEEPlugins(), []);
  assert.equal(getEEAdminRoutes(), null);
});

test("createApp stays healthy when edition was not initialized", async () => {
  resetEditionForTests();
  const { createApp } = await import("./app");
  const app = createApp();
  const paths = app.routes.map((r) => r.path);
  assert.ok(paths.includes("/health") || paths.some((p) => p.includes("health")));
  // No /api/admin/* without EE
  assert.ok(!paths.some((p) => p.startsWith("/api/admin")));
});
