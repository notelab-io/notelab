function rows(ids) {
  return ids.map((id) => ({ id }))
}

export function register({ assert, loadModule, test }) {
  test("database table row drag reorders a visible subset before the next visible anchor", async () => {
    const { getFilteredReorderedRowIds } = await loadModule(
      "/src/editor/extensions/database/table/database-table-row-drag.ts"
    )

    assert.deepEqual(
      getFilteredReorderedRowIds(
        rows(["A", "B", "C", "D", "E", "F"]),
        rows(["A", "D", "F"]),
        "F",
        1
      ),
      ["A", "B", "C", "F", "D", "E"]
    )
  })

  test("database table row drag reorders a visible subset after the previous visible anchor", async () => {
    const { getFilteredReorderedRowIds } = await loadModule(
      "/src/editor/extensions/database/table/database-table-row-drag.ts"
    )

    assert.deepEqual(
      getFilteredReorderedRowIds(
        rows(["A", "B", "C", "D", "E", "F"]),
        rows(["A", "D", "F"]),
        "D",
        3
      ),
      ["A", "B", "C", "E", "F", "D"]
    )
  })

  test("database table row drag keeps hidden rows in place when moving within a filtered gap", async () => {
    const { getFilteredReorderedRowIds } = await loadModule(
      "/src/editor/extensions/database/table/database-table-row-drag.ts"
    )

    assert.deepEqual(
      getFilteredReorderedRowIds(
        rows(["A", "B", "C", "D", "E", "F"]),
        rows(["A", "D", "F"]),
        "A",
        2
      ),
      ["B", "C", "D", "E", "A", "F"]
    )
  })

  test("database table row drag does not reorder hidden rows when the visible order is unchanged", async () => {
    const { getFilteredReorderedRowIds } = await loadModule(
      "/src/editor/extensions/database/table/database-table-row-drag.ts"
    )

    assert.equal(
      getFilteredReorderedRowIds(
        rows(["A", "B", "C", "D", "E", "F"]),
        rows(["A", "D", "F"]),
        "D",
        2
      ),
      null
    )
  })
}
