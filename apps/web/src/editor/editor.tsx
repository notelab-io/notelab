import { useCallback, useId, useRef, useState } from "react"
import { EditorContent } from "@tiptap/react"
import { MobileActionBar } from "@/packages/editor/components/editor/mobile-action-bar"
import { WorkspaceMetadata } from "@/packages/editor/components/editor/workspace-metadata"
import { starterContent } from "./constants"
import { EditorChrome } from "./editor-chrome"
import type { EditorProps, PasteChoiceState } from "./types"
import { useEditorDatabaseActions } from "./use-editor-database-actions"
import { useEditorDragHandle } from "./use-editor-drag-handle"
import { useEditorExtensions } from "./use-editor-extensions"
import { useEditorInstance } from "./use-editor-instance"
import { useEditorMenuEffects } from "./use-editor-menu-effects"
import { useEditorRuntime } from "./use-editor-runtime"
import { useMobileNodeActions } from "./use-mobile-node-actions"

export function Editor({
  content = starterContent,
  cover,
  editorContentRef,
  editable = true,
  emoji,
  fullWidth = true,
  onCollaborationReadyChange,
  onContentChange,
  onCoverChange,
  onCreatePage,
  onEmbedPage,
  onEmojiChange,
  onOpenPage,
  onTitleChange,
  organizationId,
  title,
  workspaceId,
  workspaceUpdatedAt,
}: EditorProps = {}) {
  const editorId = useId()
  const editorSurfaceRef = useRef<HTMLElement | null>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)
  const [pasteChoice, setPasteChoice] = useState<PasteChoiceState | null>(null)
  const pageContentLayout = fullWidth
    ? { className: "", mode: "full" as const }
    : { className: "mx-auto max-w-5xl", mode: "narrow" as const }

  const { databaseEditorRuntime, editorRuntimeRef } = useEditorRuntime(editable)
  const { createEditorDatabase, handleDatabasePageDrop } =
    useEditorDatabaseActions(organizationId, workspaceId)

  const { editorExtensions, editorLifecycleKey, initialContent, tocItems } =
    useEditorExtensions({
      content,
      createEditorDatabase,
      databaseEditorRuntime,
      editable,
      onCollaborationReadyChange,
      onCreatePage,
      onEmbedPage,
      onOpenPage,
      organizationId,
      workspaceId,
      workspaceUpdatedAt,
    })

  const { blockDropLine, editor } = useEditorInstance({
    databaseEditorRuntime,
    dropPageOnDatabase: handleDatabasePageDrop,
    editable,
    editorContentRef,
    editorExtensions,
    editorId,
    editorLifecycleKey,
    editorRuntimeRef,
    initialContent,
    onContentChange,
    onOpenPage,
    setPasteChoice,
    workspaceId,
  })

  useEditorMenuEffects({
    dragHandleMenuOpen,
    editorSurfaceRef,
    plusMenuOpen,
    setPlusMenuOpen,
  })

  const {
    dragHandle,
    clearDesktopDragHandle,
    resolveDragTargetFromPoint,
    updateDragTargetFromPointer,
  } = useEditorDragHandle(editor, dragHandleMenuOpen)

  const {
    mobileNodeTarget,
    canMoveMobileTarget,
    moveMobileTarget,
    handleMobileNodeClick,
  } = useMobileNodeActions(editor, resolveDragTargetFromPoint)

  const handleClosePasteChoice = useCallback(() => setPasteChoice(null), [])

  return (
    <div className="flex min-h-[calc(100svh-3rem)] w-full flex-col text-foreground">
      <section
        className="min-h-0 flex-1"
        data-editor-surface
        ref={editorSurfaceRef}
        onPointerLeave={() => !dragHandleMenuOpen && clearDesktopDragHandle()}
        onClickCapture={handleMobileNodeClick}
        onPointerMoveCapture={updateDragTargetFromPointer}
      >
        <EditorChrome
          blockDropLine={blockDropLine}
          createEditorDatabase={createEditorDatabase}
          dragHandle={dragHandle}
          editable={editable}
          editor={editor}
          editorId={editorId}
          onClosePasteChoice={handleClosePasteChoice}
          pasteChoice={pasteChoice}
          plusMenuOpen={plusMenuOpen}
          setDragHandleMenuOpen={setDragHandleMenuOpen}
          setPlusMenuOpen={setPlusMenuOpen}
          tocItems={tocItems}
        />
        <WorkspaceMetadata
          contentClassName={pageContentLayout.className}
          cover={cover}
          editable={editable}
          icon={emoji}
          onCoverChange={onCoverChange}
          onIconChange={onEmojiChange}
          onTitleChange={onTitleChange}
          organizationId={organizationId}
          title={title}
          workspaceId={workspaceId}
        />
        <div
          className={pageContentLayout.className}
          data-editor-page-content={pageContentLayout.mode}
        >
          <EditorContent editor={editor} />
        </div>
        {editable && mobileNodeTarget ? (
          <MobileActionBar
            canMoveDown={canMoveMobileTarget("down")}
            canMoveUp={canMoveMobileTarget("up")}
            onMoveDown={() => moveMobileTarget("down")}
            onMoveUp={() => moveMobileTarget("up")}
          />
        ) : null}
      </section>
    </div>
  )
}

export default Editor