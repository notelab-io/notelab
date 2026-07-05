export function register({ assert, loadModule, test }) {
  test("database property type metadata covers defaults and fallbacks", async () => {
    const propertyTypes = await loadModule(
      "/src/editor/extensions/database/database-property-types.ts"
    )

    assert.equal(propertyTypes.getDatabasePropertyType("number").label, "Number")
    assert.equal(propertyTypes.getDatabasePropertyType("unknown").type, "text")
    assert.equal(propertyTypes.getDatabasePropertyFilterKind("created_time"), "date")
    assert.equal(propertyTypes.getDatabasePropertyFilterKind("files"), "files")
    assert.equal(propertyTypes.getDatabasePropertyCellKind("date"), "date")
    assert.equal(propertyTypes.getDatabasePropertyCellKind("person"), "person")
    assert.equal(
      propertyTypes.getDatabasePropertyCellKind("created_time"),
      "read_only_time"
    )
    assert.equal(propertyTypes.getDatabasePropertyCellKind("unknown"), "input")
    assert.equal(propertyTypes.isReadOnlyPropertyType("created_time"), true)
    assert.equal(propertyTypes.isReadOnlyPropertyType("date"), false)
    assert.equal(propertyTypes.isSelectLikePropertyType("multi_select"), true)
    assert.equal(propertyTypes.isSelectLikePropertyType("person"), false)
    assert.equal(propertyTypes.hasDatabasePropertyTypeEditSettings("url"), true)
    assert.equal(propertyTypes.hasDatabasePropertyTypeEditSettings("text"), false)

    assert.deepEqual(propertyTypes.getDefaultDatabasePropertyConfig("formula"), {
      formula: "",
    })
    assert.deepEqual(propertyTypes.getDefaultDatabasePropertyConfig("status"), {
      defaultOptionId: "not-started",
      options: propertyTypes.defaultStatusOptions,
    })
    assert.equal(propertyTypes.getDefaultDatabasePropertyConfig("text"), undefined)
  })

  test("database filter operators are selected from property metadata", async () => {
    const { getDatabaseFilterOperatorsForType } = await loadModule(
      "/src/editor/extensions/database/shared/database-view-config.ts"
    )

    assert.deepEqual(
      getDatabaseFilterOperatorsForType("checkbox").map((operator) => operator.value),
      ["is", "is_not"]
    )
    assert.deepEqual(
      getDatabaseFilterOperatorsForType("created_time").map(
        (operator) => operator.value
      ),
      [
        "is",
        "is_not",
        "is_before",
        "is_after",
        "is_on_or_before",
        "is_on_or_after",
        "is_between",
        "is_relative_to_today",
        "is_empty",
        "is_not_empty",
      ]
    )
    assert.deepEqual(
      getDatabaseFilterOperatorsForType("files").map((operator) => operator.value),
      ["is_empty", "is_not_empty"]
    )
  })
}
