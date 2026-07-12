export function register({ assert, loadModule, test }) {
  test("side pane omits a database already identified by the route", async () => {
    const { getSidePaneDatabaseParam } = await loadModule(
      "/src/contexts/page-side-pane.tsx"
    )

    assert.equal(
      getSidePaneDatabaseParam("/d/database-1", "database-1"),
      null
    )
  })

  test("side pane retains a different database context", async () => {
    const { getSidePaneDatabaseParam } = await loadModule(
      "/src/contexts/page-side-pane.tsx"
    )

    assert.equal(
      getSidePaneDatabaseParam("/d/database-1", "database-2"),
      "database-2"
    )
    assert.equal(
      getSidePaneDatabaseParam("/p/page-1", "database-1"),
      "database-1"
    )
  })
}
