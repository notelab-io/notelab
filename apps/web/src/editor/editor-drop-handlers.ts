import type { EditorView } from "@tiptap/pm/view"
import {
  dropDraggedEditorBlockAt,
  getColumnBlockDragDropTarget,
  getDraggedEditorBlockPayload,
  getPlaneBlockDragDropTarget,
  hasDraggedEditorBlock,
  preparePlaneBlockDrop,
} from "@/packages/editor/components/editor/block-drag"
import {
  getDropDatabaseElement,
  hasDraggedDatabasePage,
  hasDraggedPageBlock,
  insertDraggedDatabasePage,
} from "./database-page-drag"
import type { BlockDropLine } from "./types"

const isListBlock = (typeName?: string) =>
  typeName === "listItem" || typeName === "taskItem"

export const createEditorDropHandler = (
  dropPageOnDatabase: (event: DragEvent) => boolean,
  setBlockDropLine: (line: BlockDropLine | null) => void
) => (view: EditorView, event: DragEvent) => {
  setBlockDropLine(null)
  if (dropPageOnDatabase(event)) return true

  const draggedBlock = getDraggedEditorBlockPayload(event.dataTransfer)
  const target = draggedBlock
    ? getColumnBlockDragDropTarget(view, event) ||
      (!isListBlock(draggedBlock.typeName)
        ? getPlaneBlockDragDropTarget(view, event)
        : null)
    : null

  return target
    ? dropDraggedEditorBlockAt(view, event, target.pos)
    : insertDraggedDatabasePage(view, event) || preparePlaneBlockDrop(view, event)
}

export const createEditorDragHandlers = (
  setBlockDropLine: (line: BlockDropLine | null) => void
) => ({
  dragover: (view: EditorView, event: DragEvent) => {
    const draggedBlock = getDraggedEditorBlockPayload(event.dataTransfer)
    const hasDraggedBlock = hasDraggedEditorBlock(event)
    const columnDropTarget = hasDraggedBlock
      ? getColumnBlockDragDropTarget(view, event)
      : null
    const planeDropTarget =
      hasDraggedBlock && !columnDropTarget && !isListBlock(draggedBlock?.typeName)
        ? getPlaneBlockDragDropTarget(view, event)
        : null

    setBlockDropLine(columnDropTarget?.line ?? planeDropTarget?.line ?? null)

    const hasDraggedPage =
      hasDraggedDatabasePage(event) || hasDraggedPageBlock(event)
    if (!hasDraggedBlock && !hasDraggedPage) return false

    if (getDropDatabaseElement(event) && hasDraggedPage) {
      if (event.dataTransfer) {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
      }
      return false
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".database-table-wrap")
    ) {
      return false
    }

    if (event.dataTransfer) {
      event.preventDefault()
      event.dataTransfer.dropEffect = hasDraggedBlock ? "move" : "copy"
    }
    return false
  },
  dragend: () => {
    setBlockDropLine(null)
    return false
  },
  dragleave: (view: EditorView, event: DragEvent) => {
    if (
      event.relatedTarget instanceof Node &&
      view.dom.contains(event.relatedTarget)
    ) {
      return false
    }
    setBlockDropLine(null)
    return false
  },
})