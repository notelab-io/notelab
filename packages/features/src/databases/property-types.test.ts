import assert from "node:assert/strict"
import test from "node:test"

import {
  databasePropertyTypes,
  isReadOnlyPropertyType,
  isSelectLikePropertyType,
  normalizeDatabasePropertyType,
} from "./property-types"

test("database property type helpers expose the canonical contract", () => {
  for (const type of databasePropertyTypes) {
    assert.equal(normalizeDatabasePropertyType(type), type)
  }

  assert.equal(normalizeDatabasePropertyType(undefined), "text")
  assert.equal(normalizeDatabasePropertyType(" STATUS "), "status")
  assert.equal(normalizeDatabasePropertyType(123), null)
  assert.equal(normalizeDatabasePropertyType("made_up"), null)
  assert.equal(isReadOnlyPropertyType("created_time"), true)
  assert.equal(isReadOnlyPropertyType("date"), false)
  assert.equal(isSelectLikePropertyType("multi_select"), true)
  assert.equal(isSelectLikePropertyType("person"), false)
})
