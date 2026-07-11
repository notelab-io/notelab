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

test("getAncestorIds includes embedded database row parents", () => {
  const graph = new PageGraph({
    databaseRecords: [{ id: "database", pageId: "database-page" }],
    databaseRows: [{ databaseId: "database", pageId: "row-page" }],
    pages: [
      {
        id: "host-page",
        metadata: { linkedItems: [{ id: "database-page", kind: "page" }] },
      },
      { id: "database-page", metadata: {} },
      { id: "row-page", metadata: {} },
    ],
  });

  assert.deepEqual(graph.getAncestorIds("row-page"), [
    "row-page",
    "database-page",
    "host-page",
  ]);
});

test("getAncestorIds excludes ordinary linked pages", () => {
  const graph = new PageGraph({
    pages: [
      {
        id: "host-page",
        metadata: { linkedItems: [{ id: "linked-page", kind: "page" }] },
      },
      { id: "linked-page", metadata: {} },
    ],
  });

  assert.deepEqual(graph.getAncestorIds("linked-page"), ["linked-page"]);
});

test("hasOwnedRootAccess supports multiple embedded database parents", () => {
  const graph = new PageGraph({
    databaseRecords: [{ id: "database", pageId: "database-page" }],
    databaseRows: [{ databaseId: "database", pageId: "row-page" }],
    pages: [
      {
        createdById: "first-owner",
        id: "first-host",
        metadata: { linkedItems: [{ id: "database-page", kind: "page" }] },
      },
      {
        createdById: "second-owner",
        id: "second-host",
        metadata: { linkedItems: [{ id: "database-page", kind: "page" }] },
      },
      { createdById: "database-owner", id: "database-page", metadata: {} },
      { createdById: "row-owner", id: "row-page", metadata: {} },
    ],
  });
  const ancestorIds = graph.getAncestorIds("row-page");

  assert.equal(graph.hasOwnedRootAccess(ancestorIds, "first-owner"), true);
  assert.equal(graph.hasOwnedRootAccess(ancestorIds, "second-owner"), true);
  assert.equal(graph.hasOwnedRootAccess(ancestorIds, "database-owner"), false);
});
