import assert from "node:assert/strict";
import test from "node:test";
import { PageGraph } from "./page-graph";

test("getPrimaryNestedPageIds skips linked children", () => {
  const graph = new PageGraph({
    pages: [
      { id: "parent", metadata: { linkedItems: [{ id: "linked", kind: "page" }] } },
      { id: "primary", metadata: { parentItemId: "parent" } },
      { id: "linked", metadata: { parentItemId: "elsewhere" } },
    ],
  });

  assert.deepEqual(graph.getNestedPageIds("parent").sort(), [
    "linked",
    "parent",
    "primary",
  ]);
  assert.deepEqual(graph.getPrimaryNestedPageIds("parent").sort(), [
    "parent",
    "primary",
  ]);
});