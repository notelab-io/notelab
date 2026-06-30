export function register({ assert, loadModule, test }) {
  test("getEventTextColorValue maps tokens to theme CSS variables", async () => {
    const { getEventTextColorValue } = await loadModule("/src/lib/icon-colors.ts")

    assert.equal(getEventTextColorValue(null), null)
    assert.equal(getEventTextColorValue("pink"), "var(--event-pink)")
    assert.equal(getEventTextColorValue("blue"), "var(--event-blue)")
  })

  test("resolveEventTextColorValue handles legacy token names", async () => {
    const { resolveEventTextColorValue } = await loadModule("/src/lib/icon-colors.ts")

    assert.equal(resolveEventTextColorValue("pink"), "var(--event-pink)")
    assert.equal(resolveEventTextColorValue("var(--event-pink)"), "var(--event-pink)")
    assert.equal(resolveEventTextColorValue("#ff00ff"), "#ff00ff")
  })

  test("isEventTextColorActive matches legacy and CSS variable values", async () => {
    const { isEventTextColorActive } = await loadModule("/src/lib/icon-colors.ts")

    assert.equal(isEventTextColorActive(null, null), true)
    assert.equal(isEventTextColorActive("pink", "pink"), true)
    assert.equal(isEventTextColorActive("var(--event-pink)", "pink"), true)
    assert.equal(isEventTextColorActive("blue", "pink"), false)
  })
}