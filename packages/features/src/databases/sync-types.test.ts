import assert from "node:assert/strict"
import test from "node:test"

import { getDatabaseChangedRefetchDecision } from "./realtime-utils"

test("getDatabaseChangedRefetchDecision syncs only newer remote mutations", () => {
  const ownMutationIds = new Set(["own-mutation"])

  assert.deepEqual(
    getDatabaseChangedRefetchDecision({
      currentVersion: 8,
      isOwnMutation: (clientMutationId) =>
        Boolean(clientMutationId && ownMutationIds.has(clientMutationId)),
      version: 8,
    }),
    { latestVersion: 8, shouldRefetch: false, shouldSync: false },
  )
  assert.deepEqual(
    getDatabaseChangedRefetchDecision({
      clientMutationId: "own-mutation",
      currentVersion: 8,
      isOwnMutation: (clientMutationId) =>
        Boolean(clientMutationId && ownMutationIds.has(clientMutationId)),
      version: 9,
    }),
    { latestVersion: 9, shouldRefetch: false, shouldSync: false },
  )
  assert.deepEqual(
    getDatabaseChangedRefetchDecision({
      clientMutationId: "remote-mutation",
      currentVersion: 9,
      isOwnMutation: (clientMutationId) =>
        Boolean(clientMutationId && ownMutationIds.has(clientMutationId)),
      version: 10,
    }),
    { latestVersion: 10, shouldRefetch: false, shouldSync: true },
  )
})