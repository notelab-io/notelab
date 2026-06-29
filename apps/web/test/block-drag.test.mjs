export function register({ assert, loadModule, test }) {
  test("block drag insert pos picks before or after block midpoint", async () => {
    const { resolveBlockInsertPos } = await loadModule(
      "/src/editor/components/editor/block-drag.ts"
    )

    assert.equal(resolveBlockInsertPos(10, 4, 100, 40, 110), 10)
    assert.equal(resolveBlockInsertPos(10, 4, 100, 40, 130), 14)
    assert.equal(resolveBlockInsertPos(10, 4, 100, 40, 119), 10)
  })
}