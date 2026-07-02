import assert from "node:assert/strict";
import test from "node:test";

import { normalizePropertyConfig } from "./database-mutations";

test("normalizePropertyConfig seeds default status options with colors and groups", () => {
  const config = normalizePropertyConfig("status", null) as {
    defaultOptionId?: string;
    options?: Array<{ color?: string; group?: string; id: string; name: string }>;
  };

  assert.equal(config.defaultOptionId, "not-started");
  assert.deepEqual(config.options, [
    { color: "gray", group: "To-do", id: "not-started", name: "Not started" },
    { color: "blue", group: "In progress", id: "in-progress", name: "In progress" },
    { color: "green", group: "Complete", id: "done", name: "Done" },
  ]);
});

test("normalizePropertyConfig maps status aliases and fills missing colors", () => {
  const config = normalizePropertyConfig("status", {
    options: [
      { id: "todo", name: "Todo" },
      { id: "inprogress", name: "In progress" },
      { id: "complete", name: "Complete" },
    ],
  }) as {
    options?: Array<{ color?: string; group?: string; id: string; name: string }>;
  };

  assert.deepEqual(config.options, [
    { color: "gray", group: "To-do", id: "not-started", name: "Not started" },
    { color: "blue", group: "In progress", id: "in-progress", name: "In progress" },
    { color: "green", group: "Complete", id: "done", name: "Done" },
  ]);
});

test("normalizePropertyConfig assigns cycling colors to select options", () => {
  const config = normalizePropertyConfig("select", {
    options: [
      { id: "low", name: "Low" },
      { id: "medium", name: "Medium" },
      { id: "high", name: "High" },
    ],
  }) as {
    options?: Array<{ color?: string; id: string; name: string }>;
  };

  assert.deepEqual(config.options, [
    { color: "gray", id: "low", name: "Low" },
    { color: "brown", id: "medium", name: "Medium" },
    { color: "orange", id: "high", name: "High" },
  ]);
});

test("normalizePropertyConfig preserves explicit select colors", () => {
  const config = normalizePropertyConfig("multi_select", {
    options: [{ color: "red", id: "blocked", name: "Blocked" }],
  }) as {
    options?: Array<{ color?: string; id: string; name: string }>;
  };

  assert.deepEqual(config.options, [
    { color: "red", id: "blocked", name: "Blocked" },
  ]);
});