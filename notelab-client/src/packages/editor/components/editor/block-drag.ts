import type { Editor } from "@tiptap/react"
import {
  Fragment,
  Slice,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

import type { DragHandleTarget } from "./types"

export const EDITOR_BLOCK_DRAG_MIME =
  "application/x-notelab-editor-block-drag"

export type BlockDragPayload = {
  editorId: string
  node: unknown
  pos: number
  textContent: string
  typeName: string
}

const dragSourceEditors = new Map<string, Editor>()
let activeBlockDragPayload: BlockDragPayload | null = null

const blockDragSelectors = [
  "li",
  "p",
  ".code-block-shiki",
  "blockquote",
  "h1, h2, h3, h4, h5, h6",
  "[data-type=horizontalRule]",
  "table",
  ".image-block",
  ".video-block",
  ".embed-block",
  ".file-block",
  ".bookmark-block",
  ".database-block",
  ".page-block",
  ".editor-details",
].join(", ")

const parentContainerTypes = new Set([
  "blockquote",
  "details",
  "detailsContent",
  "bulletList",
  "orderedList",
  "taskList",
  "tableRow",
  "tableCell",
  "tableHeader",
  "column",
  "columnBlock",
])

export function registerBlockDragSource(editorId: string, editor: Editor) {
  dragSourceEditors.set(editorId, editor)

  return () => {
    if (dragSourceEditors.get(editorId) === editor) {
      dragSourceEditors.delete(editorId)
    }
  }
}

export function setDraggedBlockData({
  dataTransfer,
  editorId,
  target,
}: {
  dataTransfer: DataTransfer
  editorId: string
  target: DragHandleTarget
}) {
  const payload =
    activeBlockDragPayload?.editorId === editorId
      ? activeBlockDragPayload
      : createBlockDragPayload(editorId, target)

  activeBlockDragPayload = payload
  dataTransfer.effectAllowed = "move"
  dataTransfer.setData(EDITOR_BLOCK_DRAG_MIME, JSON.stringify(payload))
}

export function beginActiveBlockDrag(editorId: string, target: DragHandleTarget) {
  activeBlockDragPayload = createBlockDragPayload(editorId, target)
}

export function clearActiveBlockDrag() {
  activeBlockDragPayload = null
}

export function hasDraggedEditorBlock(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes(
    EDITOR_BLOCK_DRAG_MIME,
  ) || Boolean(activeBlockDragPayload)
}

export function resolvePlaneDragTargetFromPoint({
  clientX,
  clientY,
  currentTarget,
  view,
}: {
  clientX: number
  clientY: number
  currentTarget?: DragHandleTarget | null
  view: EditorView
}): DragHandleTarget | null {
  const editorElement = view.dom
  const root = view.root
  const elements = root.elementsFromPoint(clientX, clientY)
  const isOverDragHandle = elements.some(
    (element) =>
      element instanceof HTMLElement && Boolean(element.closest(".drag-handle"))
  )

  if (isOverDragHandle) {
    return currentTarget ?? null
  }

  const isInsideEditor = elements.some(
    (element) =>
      element instanceof HTMLElement && editorElement.contains(element)
  )

  if (!isInsideEditor) {
    if (!currentTarget) {
      return null
    }

    const currentDom = view.nodeDOM(currentTarget.pos)

    if (currentDom instanceof HTMLElement) {
      const rect = currentDom.getBoundingClientRect()

      if (clientY >= rect.top && clientY <= rect.bottom) {
        return currentTarget
      }
    }

    return null
  }

  const domNode = nodeDOMAtCoords({ clientX, clientY })

  if (domNode) {
    const target = targetFromDOMNode(view, domNode)

    if (target) {
      return target
    }
  }

  const coords = view.posAtCoords({
    left: clientX,
    top: clientY,
  })

  if (!coords) {
    return null
  }

  return targetFromResolvedPosition(view, coords.pos)
}

export function getPlaneDragHandleRect(
  view: EditorView,
  target: DragHandleTarget,
) {
  const domNode = view.nodeDOM(target.pos)

  if (!(domNode instanceof HTMLElement)) {
    return null
  }

  const nodeRect = domNode.getBoundingClientRect()
  const editorRect = view.dom.getBoundingClientRect()
  const handleWidth = 56
  const handleGap = 8
  const anchorRect = getDragHandleAnchorRect(domNode) ?? nodeRect
  const railLeft = Math.max(
    editorRect.left + 4,
    anchorRect.left - handleWidth - handleGap,
  )

  return {
    left: railLeft,
    top: nodeRect.top,
  }
}

function getDragHandleAnchorRect(domNode: HTMLElement) {
  const blockquote = domNode.closest<HTMLElement>("blockquote")

  if (blockquote) {
    return blockquote.getBoundingClientRect()
  }

  const listItem = domNode.closest<HTMLElement>("li")
  const list = listItem?.parentElement?.closest<HTMLElement>("ul, ol")

  if (list && list.dataset.type !== "taskList") {
    return list.getBoundingClientRect()
  }

  return null
}

export function startPlaneBlockDrag({
  editorId,
  event,
  target,
  view,
}: {
  editorId: string
  event: DragEvent
  target: DragHandleTarget
  view: EditorView
}) {
  view.focus()

  try {
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, target.pos)))
  } catch {
    return false
  }

  if (!event.dataTransfer) {
    return false
  }

  const slice = view.state.selection.content()
  const { dom, text } = view.serializeForClipboard(slice)
  const dragImage = view.nodeDOM(target.pos)

  setDraggedBlockData({
    dataTransfer: event.dataTransfer,
    editorId,
    target,
  })
  event.dataTransfer.setData("text/html", dom.innerHTML)
  event.dataTransfer.setData("text/plain", text)
  event.dataTransfer.effectAllowed = "copyMove"

  if (dragImage instanceof Element) {
    event.dataTransfer.setDragImage(dragImage, 0, 0)
  }

  view.dragging = { slice, move: !event.ctrlKey }
  view.dom.classList.add("dragging")

  return true
}

export function preparePlaneBlockDrop(view: EditorView, event: DragEvent) {
  view.dom.classList.remove("dragging")

  const dropPos = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  })

  if (!dropPos || !(view.state.selection instanceof NodeSelection)) {
    return false
  }

  const droppedNode = view.state.selection.node

  if (droppedNode.type.name !== "listItem" && droppedNode.type.name !== "taskItem") {
    return false
  }

  const resolvedPos = view.state.doc.resolve(dropPos.pos)
  let isDroppedInsideList = false
  let dropDepth = 0

  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    const typeName = resolvedPos.node(depth).type.name

    if (typeName === "listItem" || typeName === "taskItem") {
      isDroppedInsideList = true
      dropDepth = depth
      break
    }
  }

  let slice = view.state.selection.content()
  let nextFragment = slice.content

  if (!isDroppedInsideList || dropDepth !== resolvedPos.depth) {
    nextFragment = flattenListStructure(nextFragment, view.state.schema)
  }

  if (!isDroppedInsideList) {
    const listType = getClosestListType(view, droppedNode)
    const listNodeType =
      listType === "orderedList"
        ? view.state.schema.nodes.orderedList
        : view.state.schema.nodes.bulletList

    if (listNodeType) {
      nextFragment = Fragment.from(listNodeType.create(null, nextFragment))
    }
  }

  slice = new Slice(nextFragment, slice.openStart, slice.openEnd)
  view.dragging = { slice, move: !event.ctrlKey }

  return false
}

export function getDraggedEditorBlockPayload(dataTransfer: DataTransfer | null) {
  return parseDraggedBlockPayload(dataTransfer)
}

export function deleteDraggedEditorBlockSource(payload: BlockDragPayload) {
  const sourceEditor = dragSourceEditors.get(payload.editorId)

  if (!sourceEditor) {
    return false
  }

  const deleted = deleteDraggedSourceNode(sourceEditor.view, payload)

  if (deleted) {
    clearActiveBlockDrag()
  }

  return deleted
}

export function endPlaneBlockDrag(view?: EditorView) {
  view?.dom.classList.remove("dragging")
  clearActiveBlockDrag()
}

function createBlockDragPayload(
  editorId: string,
  target: DragHandleTarget,
): BlockDragPayload {
  return {
    editorId,
    node: target.node.toJSON(),
    pos: target.pos,
    textContent: target.node.textContent,
    typeName: target.node.type.name,
  }
}

function parseDraggedBlockPayload(dataTransfer: DataTransfer | null) {
  const rawPayload = dataTransfer?.getData(EDITOR_BLOCK_DRAG_MIME)

  if (!rawPayload) {
    return activeBlockDragPayload
  }

  try {
    const payload = JSON.parse(rawPayload) as Partial<BlockDragPayload>

    if (
      typeof payload.editorId !== "string" ||
      typeof payload.pos !== "number" ||
      typeof payload.textContent !== "string" ||
      typeof payload.typeName !== "string" ||
      !payload.node
    ) {
      return null
    }

    return payload as BlockDragPayload
  } catch {
    return null
  }
}

function nodeDOMAtCoords({
  clientX,
  clientY,
}: {
  clientX: number
  clientY: number
}) {
  const elements = document.elementsFromPoint(clientX, clientY)

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue
    }

    if (element.matches("table")) {
      return element
    }

    if (element.closest("table") && !element.matches("table")) {
      continue
    }

    if (element.matches(blockDragSelectors)) {
      return element
    }
  }

  return null
}

function targetFromDOMNode(view: EditorView, domNode: HTMLElement) {
  const rect = domNode.getBoundingClientRect()
  const coords = view.posAtCoords({
    left: rect.left + 50,
    top: rect.top + 1,
  })

  if (!coords || coords.inside < 0) {
    return null
  }

  if (domNode.matches("table")) {
    const tablePos = Math.max(0, coords.inside - 2)
    const tableNode = view.state.doc.nodeAt(tablePos)

    if (tableNode) {
      return { node: tableNode, pos: tablePos }
    }
  }

  if (domNode.matches("blockquote")) {
    const blockquoteCoords = view.posAtCoords({
      left: rect.left + 1,
      top: rect.top + 1,
    })

    if (blockquoteCoords && blockquoteCoords.inside >= 0) {
      return targetFromResolvedPosition(view, blockquoteCoords.inside)
    }
  }

  return targetFromResolvedPosition(view, coords.inside)
}

function targetFromResolvedPosition(view: EditorView, pos: number) {
  const $pos = view.state.doc.resolve(Math.max(0, Math.min(pos, view.state.doc.content.size)))

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    const parent = depth > 0 ? $pos.node(depth - 1) : null
    const index = depth > 0 ? $pos.index(depth - 1) : 0

    if (node.isInline || node.isText) {
      continue
    }

    if (parentContainerTypes.has(node.type.name)) {
      continue
    }

    if (
      index === 0 &&
      (parent?.type.name === "taskItem" || parent?.type.name === "listItem")
    ) {
      continue
    }

    const nodePos = $pos.before(depth)

    return { node, pos: nodePos }
  }

  const topNode = view.state.doc.nodeAt(pos)

  if (!topNode) {
    return null
  }

  if (parentContainerTypes.has(topNode.type.name)) {
    return firstDraggableDescendant(topNode, pos)
  }

  return { node: topNode, pos }
}

function firstDraggableDescendant(
  node: ProseMirrorNode,
  pos: number,
): DragHandleTarget | null {
  let target: DragHandleTarget | null = null

  node.forEach((child, offset) => {
    if (target) {
      return
    }

    const childPos = pos + offset + 1

    if (
      child.isInline ||
      child.isText ||
      parentContainerTypes.has(child.type.name)
    ) {
      if (!child.isInline && !child.isText) {
        target = firstDraggableDescendant(child, childPos)
      }

      return
    }

    target = { node: child, pos: childPos }
  })

  return target
}

function getClosestListType(view: EditorView, node: ProseMirrorNode) {
  const { from } = view.state.selection
  const $pos = view.state.doc.resolve(from)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const typeName = $pos.node(depth).type.name

    if (typeName === "orderedList" || typeName === "bulletList") {
      return typeName
    }
  }

  return node.type.name === "taskItem" ? "bulletList" : "bulletList"
}

function flattenListStructure(fragment: Fragment, schema: Schema) {
  const result: ProseMirrorNode[] = []

  fragment.forEach((node) => {
    if (node.type !== schema.nodes.listItem && node.type !== schema.nodes.taskItem) {
      return
    }

    result.push(node)

    const firstChild = node.content.firstChild

    if (
      firstChild &&
      (firstChild.type === schema.nodes.bulletList ||
        firstChild.type === schema.nodes.orderedList)
    ) {
      flattenListStructure(firstChild.content, schema).forEach((child) => {
        result.push(child)
      })
    }
  })

  return Fragment.from(result)
}

function deleteDraggedSourceNode(view: EditorView, payload: BlockDragPayload) {
  const sourceNode = getValidatedSourceNode(view, payload)

  if (!sourceNode) {
    return false
  }

  view.dispatch(
    view.state.tr
      .delete(payload.pos, payload.pos + sourceNode.nodeSize)
      .scrollIntoView(),
  )

  return true
}

function getValidatedSourceNode(
  view: EditorView,
  payload: BlockDragPayload,
) {
  let expectedNode: ProseMirrorNode

  try {
    expectedNode = view.state.schema.nodeFromJSON(payload.node)
  } catch {
    return null
  }

  const sourceNode = view.state.doc.nodeAt(payload.pos)

  if (
    !sourceNode ||
    sourceNode.type.name !== payload.typeName ||
    sourceNode.textContent !== payload.textContent ||
    !sourceNode.sameMarkup(expectedNode)
  ) {
    return null
  }

  return sourceNode
}
