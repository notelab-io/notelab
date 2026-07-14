export function register({ assert, loadModule, test }) {
  test("Yjs comments converge across collaborators", async () => {
    const {
      applyCommentUpdate,
      createCommentDocument,
      createPageCommentController,
      encodeCommentState,
    } = await loadModule(
      "/src/comments/yjs-comments.ts",
    )
    const firstDocument = createCommentDocument()
    const secondDocument = createCommentDocument()
    const first = createPageCommentController({
      canEdit: true,
      canModerate: false,
      document: firstDocument,
      user: author("user-1", "One"),
    })

    const threadId = first.createPageThread("First message")
    applyCommentUpdate(secondDocument, encodeCommentState(firstDocument))
    const second = createPageCommentController({
      canEdit: true,
      canModerate: false,
      document: secondDocument,
      user: author("user-2", "Two"),
    })

    first.reply(threadId, "Reply from one")
    second.reply(threadId, "Reply from two")
    applyCommentUpdate(firstDocument, encodeCommentState(secondDocument))
    applyCommentUpdate(secondDocument, encodeCommentState(firstDocument))

    assert.deepEqual(
      first.getSnapshot().threads[0].comments.map((comment) => comment.body).sort(),
      ["First message", "Reply from one", "Reply from two"].sort(),
    )
    assert.deepEqual(first.getSnapshot().threads, second.getSnapshot().threads)
    first.destroy()
    second.destroy()
  })

  test("Yjs comment reactions aggregate and readonly controllers reject writes", async () => {
    const { createCommentDocument, createPageCommentController } = await loadModule(
      "/src/comments/yjs-comments.ts",
    )
    const document = createCommentDocument()
    const writable = createPageCommentController({
      canEdit: true,
      canModerate: false,
      document,
      user: author("user-1", "One"),
    })
    const threadId = writable.createPageThread("Hello")
    const messageId = writable.getSnapshot().threads[0].comments[0].id
    writable.addReaction(threadId, messageId, "👍")

    assert.deepEqual(
      writable.getSnapshot().threads[0].comments[0].reactions,
      [{ count: 1, emoji: "👍", reactedByMe: true }],
    )

    const readonly = createPageCommentController({
      canEdit: false,
      canModerate: false,
      document,
      user: author("viewer", "Viewer"),
    })
    assert.throws(() => readonly.reply(threadId, "No"), /read-only/)
    writable.destroy()
    readonly.destroy()
  })
}

function author(id, name) {
  return { email: `${id}@example.com`, id, image: null, name }
}
