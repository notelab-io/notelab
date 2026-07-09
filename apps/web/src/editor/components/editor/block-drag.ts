import type { DragEvent as ReactDragEvent } from "react"
import type { Editor } from "@tiptap/react"
import {
  Fragment,
  Slice,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

import type { BlockDropLine } from "@/editor/types"
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

type DropTarget = {
  line: BlockDropLine
  pos: number
}

type Point = {
  x: number
  y: number
}

type HorizontalAnchor = {
  left: number
  right: number
}

type DragDropBridge = {
  dropPageOnDatabase: (event: DragEvent) => boolean
  getView: () => EditorView | null
  insertDraggedPage: (view: EditorView, event: DragEvent) => boolean
  isDraggingPage: (event: DragEvent) => boolean
  isOverDatabaseDrop: (event: DragEvent) => boolean
  shouldSkipDropLine: (event: DragEvent) => boolean
  surfaceRef?: { current: HTMLElement | null }
}

const BLOCK_SELECTOR = [
  "li",
  "p",
  ".code-block-shiki",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
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
].join(",")

const STRUCTURAL_NODE_TYPES = new Set([
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

const DATABASE_BLOCK_SELECTOR = ".database-block, .node-databaseBlock"
const DATABASE_INLINE_SCROLL_SELECTOR = ".database-inline-scroll"
const DIALOG_CONTENT_SELECTOR = '[data-slot="dialog-content"]'
const DRAG_HANDLE_SELECTOR = ".drag-handle"
const EDITOR_DRAGGING_CLASS = "dragging"
const MIN_COORD_INSET = 4

const sourceEditors = new Map<string, Editor>()
let activeDragPayload: BlockDragPayload | null = null

const isListItemType = (typeName?: string) =>
  typeName === "listItem" || typeName === "taskItem"

const numberStyle = (element: HTMLElement, property: "paddingLeft" | "paddingRight" | "paddingTop") =>
  Number.parseFloat(window.getComputedStyle(element)[property]) || 0

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const toPayload = (
  editorId: string,
  target: DragHandleTarget,
): BlockDragPayload => ({
  editorId,
  node: target.node.toJSON(),
  pos: target.pos,
  textContent: target.node.textContent,
  typeName: target.node.type.name,
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isBlockDragPayload = (value: unknown): value is BlockDragPayload => {
  if (!isObject(value)) return false

  return (
    typeof value.editorId === "string" &&
    typeof value.pos === "number" &&
    typeof value.textContent === "string" &&
    typeof value.typeName === "string" &&
    value.node != null
  )
}

function parsePayload(dataTransfer: DataTransfer | null) {
  try {
    const raw = dataTransfer?.getData(EDITOR_BLOCK_DRAG_MIME)
    if (raw) {
      const payload = JSON.parse(raw) as unknown
      return isBlockDragPayload(payload) ? payload : null
    }

    return isBlockDragPayload(activeDragPayload) ? activeDragPayload : null
  } catch {
    return null
  }
}

export const getDraggedEditorBlockPayload = parsePayload

function resetDragSession(view?: EditorView | null) {
  view?.dom.classList.remove(EDITOR_DRAGGING_CLASS)
  activeDragPayload = null
}

function dialogOffset(element: HTMLElement) {
  const dialog = element.closest(DIALOG_CONTENT_SELECTOR)

  if (!(dialog instanceof HTMLElement)) {
    return { left: 0, top: 0 }
  }

  const rect = dialog.getBoundingClientRect()
  return { left: rect.left, top: rect.top }
}

function dropLineAt(
  view: EditorView,
  pos: number,
  anchor?: HorizontalAnchor,
): BlockDropLine {
  const editorRect = view.dom.getBoundingClientRect()
  const offset = dialogOffset(view.dom)
  const left = anchor?.left ?? editorRect.left + numberStyle(view.dom, "paddingLeft")
  const right = anchor?.right ?? editorRect.right - numberStyle(view.dom, "paddingRight")

  return {
    left: left - offset.left,
    right: right - offset.left,
    top: view.coordsAtPos(pos).top - offset.top,
  }
}

function clampedEditorCoords(view: EditorView, point: Point) {
  const rect = view.dom.getBoundingClientRect()

  return view.posAtCoords({
    left: clamp(point.x, rect.left + MIN_COORD_INSET, rect.right - MIN_COORD_INSET),
    top: clamp(point.y, rect.top + MIN_COORD_INSET, rect.bottom - MIN_COORD_INSET),
  })
}

function elementsFromPoint(view: EditorView, point: Point) {
  return view.root.elementsFromPoint(point.x, point.y)
}

function isSelectableBlock(
  node: ProseMirrorNode,
  parent: ProseMirrorNode | null,
  indexInParent: number,
) {
  if (node.isInline || node.isText) return false
  if (STRUCTURAL_NODE_TYPES.has(node.type.name)) return false
  if (isListItemType(parent?.type.name) && indexInParent === 0) return false

  return true
}

function firstSelectableChild(node: ProseMirrorNode, pos: number): DragHandleTarget | null {
  let match: DragHandleTarget | null = null

  node.forEach((child, offset) => {
    if (match || child.isInline || child.isText) return

    const childPos = pos + offset + 1
    if (STRUCTURAL_NODE_TYPES.has(child.type.name)) {
      match = firstSelectableChild(child, childPos)
      return
    }

    match = { node: child, pos: childPos }
  })

  return match
}

function blockFromPos(view: EditorView, pos: number): DragHandleTarget | null {
  const doc = view.state.doc
  const resolvedPos = doc.resolve(clamp(pos, 0, doc.content.size))

  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    const node = resolvedPos.node(depth)
    const parent = resolvedPos.node(depth - 1)
    const indexInParent = resolvedPos.index(depth - 1)

    if (!isSelectableBlock(node, parent, indexInParent)) continue

    return { node, pos: resolvedPos.before(depth) }
  }

  const topNode = doc.nodeAt(pos)
  if (!topNode) return null
  if (isSelectableBlock(topNode, null, 0)) return { node: topNode, pos }

  return firstSelectableChild(topNode, pos)
}

function blockFromDOM(view: EditorView, element: HTMLElement): DragHandleTarget | null {
  const rect = element.getBoundingClientRect()
  const coords = view.posAtCoords({
    left: rect.left + Math.min(50, Math.max(1, rect.width / 2)),
    top: rect.top + 1,
  })

  if (!coords || coords.inside < 0) return null

  if (element.matches("table")) {
    const tablePos = Math.max(0, coords.inside - 2)
    const table = view.state.doc.nodeAt(tablePos)
    return table ? { node: table, pos: tablePos } : null
  }

  if (element.matches("blockquote")) {
    const inside = view.posAtCoords({ left: rect.left + 1, top: rect.top + 1 })?.inside
    if (inside != null && inside >= 0) return blockFromPos(view, inside)
  }

  return blockFromPos(view, coords.inside)
}

function blockElementAtPoint(view: EditorView, point: Point) {
  for (const element of elementsFromPoint(view, point)) {
    if (!(element instanceof HTMLElement) || !view.dom.contains(element)) continue
    if (element.matches("table")) return element
    if (element.closest("table")) continue
    if (element.matches(BLOCK_SELECTOR)) return element
  }

  return null
}

function dropLineAnchor(element: HTMLElement): HorizontalAnchor | null {
  const blockquote = element.closest("blockquote")
  if (blockquote) return blockquote.getBoundingClientRect()

  const list = element.closest("li")?.parentElement?.closest<HTMLElement>("ul, ol")
  if (list && list.dataset.type !== "taskList") return list.getBoundingClientRect()

  return null
}

export function resolveBlockInsertPos(
  blockPos: number,
  blockSize: number,
  blockTop: number,
  blockHeight: number,
  clientY: number,
) {
  return clientY < blockTop + blockHeight / 2 ? blockPos : blockPos + blockSize
}

function nodeAtDOM(
  view: EditorView,
  element: HTMLElement,
  typeName: string,
): { node: ProseMirrorNode; pos: number } | null {
  let match: { node: ProseMirrorNode; pos: number } | null = null

  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== typeName || view.nodeDOM(pos) !== element) return

    match = { node, pos }
    return false
  })

  return match
}

function columnDropTarget(view: EditorView, point: Point): DropTarget | null {
  for (const element of elementsFromPoint(view, point)) {
    if (!(element instanceof HTMLElement)) continue

    const column = element.closest<HTMLElement>(".column[data-type='column']")
    if (!column || !view.dom.contains(column)) continue

    const match = nodeAtDOM(view, column, "column")
    if (!match) continue

    let insertPos = match.pos + 1 + match.node.content.size
    let found = false

    match.node.forEach((_child, offset) => {
      if (found) return

      const childPos = match.pos + offset + 1
      const childDom = view.nodeDOM(childPos)
      if (!(childDom instanceof HTMLElement)) return

      const childRect = childDom.getBoundingClientRect()
      if (point.y < (childRect.top + childRect.bottom) / 2) {
        insertPos = childPos
        found = true
      }
    })

    const rect = column.getBoundingClientRect()
    const anchor = {
      left: rect.left + numberStyle(column, "paddingLeft"),
      right: rect.right - numberStyle(column, "paddingRight"),
    }

    return { line: dropLineAt(view, insertPos, anchor), pos: insertPos }
  }

  return null
}

function blockDropTarget(view: EditorView, point: Point): DropTarget | null {
  const coords = clampedEditorCoords(view, point)
  if (!coords) return null

  const target = blockFromPos(view, coords.pos)
  if (!target) {
    const endPos = view.state.doc.content.size
    return { line: dropLineAt(view, endPos), pos: endPos }
  }

  const dom = view.nodeDOM(target.pos)
  if (!(dom instanceof HTMLElement)) return null

  const rect = dom.getBoundingClientRect()
  const pos = resolveBlockInsertPos(
    target.pos,
    target.node.nodeSize,
    rect.top,
    rect.height,
    point.y,
  )

  return { line: dropLineAt(view, pos, dropLineAnchor(dom) ?? rect), pos }
}

export function getEditorInsertDropTarget(view: EditorView, event: DragEvent) {
  const point = { x: event.clientX, y: event.clientY }
  return columnDropTarget(view, point) ?? blockDropTarget(view, point)
}

export function registerBlockDragSource(editorId: string, editor: Editor) {
  sourceEditors.set(editorId, editor)

  return () => {
    if (sourceEditors.get(editorId) === editor) sourceEditors.delete(editorId)
  }
}

export function armBlockDrag(editorId: string, target: DragHandleTarget) {
  activeDragPayload = toPayload(editorId, target)
}

export function resolveBlockDragTargetFromPoint({
  clientX,
  clientY,
  currentTarget,
  view,
}: {
  clientX: number
  clientY: number
  currentTarget?: DragHandleTarget | null
  view: EditorView
}) {
  const point = { x: clientX, y: clientY }
  const elements = elementsFromPoint(view, point)

  if (
    elements.some(
      (element) =>
        element instanceof HTMLElement && Boolean(element.closest(DRAG_HANDLE_SELECTOR)),
    )
  ) {
    return currentTarget ?? null
  }

  if (
    !elements.some(
      (element) => element instanceof HTMLElement && view.dom.contains(element),
    )
  ) {
    return null
  }

  const element = blockElementAtPoint(view, point)
  return element ? blockFromDOM(view, element) : null
}

export function getBlockDragHandleRect(view: EditorView, target: DragHandleTarget) {
  const nodeDom = view.nodeDOM(target.pos)
  if (!(nodeDom instanceof HTMLElement)) return null

  const editorRect = view.dom.getBoundingClientRect()
  let anchor = nodeDom
  let top = nodeDom.getBoundingClientRect().top

  if (target.node.type.name === "databaseBlock") {
    const block = nodeDom.closest<HTMLElement>(DATABASE_BLOCK_SELECTOR) ?? nodeDom
    const toolbar = block.querySelector<HTMLElement>(".database-toolbar")
    const section = block.querySelector<HTMLElement>(".database-toolbar-section")
    const verticalToolbar = toolbar?.firstElementChild

    if (verticalToolbar instanceof HTMLElement) {
      top = verticalToolbar.getBoundingClientRect().top
    }

    anchor = section ?? block
  }

  const anchorRect = anchor.getBoundingClientRect()
  const offset = dialogOffset(view.dom)
  const left = anchorRect.left + numberStyle(anchor, "paddingLeft")

  return {
    left: Math.max(editorRect.left + MIN_COORD_INSET, left - 64) - offset.left,
    top: top + numberStyle(anchor, "paddingTop") - offset.top,
  }
}

export function getDatabaseBlockDragImagePlacement(
  pointerX: number,
  pointerY: number,
  blockLeft: number,
  blockTop: number,
) {
  return {
    offsetX: Math.max(0, pointerX - blockLeft),
    offsetY: Math.max(0, pointerY - blockTop),
    paddingLeft: Math.max(0, blockLeft - pointerX),
  }
}

function lockDatabaseScrollClone(clone: HTMLElement, width: number) {
  clone
    .querySelectorAll<HTMLElement>(".database-inline-scroll-wrap[data-inline-scroll='true']")
    .forEach((element) => {
      element.style.setProperty("--database-inline-scroll-offset", "0px")
      element.style.setProperty("--database-inline-scroll-viewport-width", `${width}px`)
    })

  clone.querySelectorAll<HTMLElement>(DATABASE_INLINE_SCROLL_SELECTOR).forEach((element) => {
    element.style.marginLeft = "0"
    element.style.width = `${width}px`
    element.style.maxWidth = `${width}px`
    element.style.overflow = "hidden"
  })

  clone
    .querySelectorAll<HTMLElement>(".database-inline-scroll-content")
    .forEach((element) => {
      element.style.paddingLeft = "0"
    })
}

function setDatabaseBlockDragImage(event: DragEvent, image: Element) {
  if (!(image instanceof HTMLElement) || !event.dataTransfer) return false

  const block = image.closest<HTMLElement>(DATABASE_BLOCK_SELECTOR) ?? image
  const rect = block.getBoundingClientRect()
  if (!rect.width || !rect.height) return false

  const placement = getDatabaseBlockDragImagePlacement(
    event.clientX,
    event.clientY,
    rect.left,
    rect.top,
  )
  const clone = block.cloneNode(true) as HTMLElement
  const scrollLefts = Array.from(
    block.querySelectorAll<HTMLElement>(DATABASE_INLINE_SCROLL_SELECTOR),
    (element) => element.scrollLeft,
  )
  const dragImage = document.createElement("div")

  dragImage.className = "tiptap-editor"
  dragImage.style.position = "fixed"
  dragImage.style.top = "-10000px"
  dragImage.style.left = "0"
  dragImage.style.width = `${rect.width + placement.paddingLeft}px`
  dragImage.style.height = `${rect.height}px`
  dragImage.style.pointerEvents = "none"
  dragImage.style.setProperty("--database-inline-scroll-offset", "0px")
  dragImage.style.setProperty("--database-inline-scroll-viewport-width", `${rect.width}px`)

  clone.style.margin = "0"
  clone.style.marginLeft = `${placement.paddingLeft}px`
  clone.style.width = `${rect.width}px`
  clone.style.maxWidth = `${rect.width}px`
  clone.style.overflow = "hidden"
  lockDatabaseScrollClone(clone, rect.width)

  dragImage.appendChild(clone)
  document.body.appendChild(dragImage)

  clone.querySelectorAll<HTMLElement>(DATABASE_INLINE_SCROLL_SELECTOR).forEach((element, index) => {
    element.scrollLeft = scrollLefts[index] ?? 0
  })

  event.dataTransfer.setDragImage(dragImage, placement.offsetX, placement.offsetY)
  window.requestAnimationFrame(() => dragImage.remove())

  return true
}

export function startBlockDrag({
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
  view.dom.classList.add(EDITOR_DRAGGING_CLASS)
  document.getSelection()?.removeAllRanges()
  view.focus()

  try {
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, target.pos)))
  } catch {
    resetDragSession(view)
    return false
  }

  if (!event.dataTransfer) {
    resetDragSession(view)
    return false
  }

  const payload = toPayload(editorId, target)
  activeDragPayload = payload

  const slice = view.state.selection.content()
  const { dom, text } = view.serializeForClipboard(slice)
  const isDatabaseBlock = target.node.type.name === "databaseBlock"
  const dragImageSource = view.nodeDOM(target.pos)

  event.dataTransfer.effectAllowed = "copyMove"
  event.dataTransfer.setData(EDITOR_BLOCK_DRAG_MIME, JSON.stringify(payload))
  if (!isDatabaseBlock) event.dataTransfer.setData("text/html", dom.innerHTML)
  event.dataTransfer.setData("text/plain", text)

  if (
    dragImageSource instanceof Element &&
    (!isDatabaseBlock || !setDatabaseBlockDragImage(event, dragImageSource))
  ) {
    event.dataTransfer.setDragImage(dragImageSource, 0, 0)
  }

  view.dragging = { slice, move: !event.ctrlKey }
  return true
}

export function endBlockDrag(view?: EditorView) {
  resetDragSession(view)
}

function sourceNode(view: EditorView, payload: BlockDragPayload) {
  try {
    const expected = view.state.schema.nodeFromJSON(payload.node)
    const current = view.state.doc.nodeAt(payload.pos)

    if (
      current &&
      current.type.name === payload.typeName &&
      current.textContent === payload.textContent &&
      current.sameMarkup(expected)
    ) {
      return current
    }
  } catch {
    return null
  }

  return null
}

function deleteSource(view: EditorView, payload: BlockDragPayload) {
  const node = sourceNode(view, payload)
  if (!node) return false

  view.dispatch(
    view.state.tr.delete(payload.pos, payload.pos + node.nodeSize).scrollIntoView(),
  )
  return true
}

export function deleteDraggedEditorBlockSource(payload: BlockDragPayload) {
  const editor = sourceEditors.get(payload.editorId)
  if (!editor || !deleteSource(editor.view, payload)) return false

  resetDragSession(editor.view)
  return true
}

function canInsertNodeAt(view: EditorView, pos: number, node: ProseMirrorNode) {
  const resolvedPos = view.state.doc.resolve(pos)

  for (let depth = resolvedPos.depth; depth >= 0; depth -= 1) {
    const index = resolvedPos.index(depth)
    if (resolvedPos.node(depth).canReplaceWith(index, index, node.type, node.marks)) {
      return true
    }
  }

  return false
}

function dropBlock(view: EditorView, event: DragEvent, pos: number) {
  const payload = parsePayload(event.dataTransfer)
  if (!payload) return false

  let node: ProseMirrorNode
  try {
    node = view.state.schema.nodeFromJSON(payload.node)
  } catch {
    return false
  }

  if (!canInsertNodeAt(view, pos, node)) return false

  const source = sourceEditors.get(payload.editorId)
  let insertPos = pos
  let transaction = view.state.tr

  if (source?.view === view) {
    const dragged = sourceNode(view, payload)
    if (!dragged) return false

    const from = payload.pos
    const to = from + dragged.nodeSize
    if (insertPos >= from && insertPos <= to) {
      event.preventDefault()
      return true
    }

    transaction = transaction.delete(from, to)
    if (from < insertPos) insertPos -= dragged.nodeSize
  }

  try {
    view.dispatch(transaction.insert(insertPos, node).scrollIntoView())
  } catch {
    return false
  }

  view.focus()
  if (source && source.view !== view) deleteSource(source.view, payload)

  event.preventDefault()
  resetDragSession(view)
  return true
}

function flattenList(fragment: Fragment, schema: Schema) {
  const nodes: ProseMirrorNode[] = []

  fragment.forEach((node) => {
    if (!isListItemType(node.type.name)) return

    nodes.push(node)

    const nestedList = node.content.firstChild
    if (
      nestedList &&
      (nestedList.type === schema.nodes.bulletList ||
        nestedList.type === schema.nodes.orderedList)
    ) {
      flattenList(nestedList.content, schema).forEach((child) => nodes.push(child))
    }
  })

  return Fragment.from(nodes)
}

function enclosingListItemDepth(view: EditorView, pos: number) {
  const resolvedPos = view.state.doc.resolve(pos)

  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    if (isListItemType(resolvedPos.node(depth).type.name)) return depth
  }

  return null
}

function listTypeForSelection(view: EditorView) {
  const from = view.state.doc.resolve(view.state.selection.from)

  for (let depth = from.depth; depth > 0; depth -= 1) {
    const typeName = from.node(depth).type.name
    if (typeName === "orderedList" || typeName === "bulletList") return typeName
  }

  return "bulletList"
}

function prepareListDrop(view: EditorView, event: DragEvent) {
  view.dom.classList.remove(EDITOR_DRAGGING_CLASS)

  const dropPos = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!dropPos || !(view.state.selection instanceof NodeSelection)) return false

  const dropped = view.state.selection.node
  if (!isListItemType(dropped.type.name)) return false

  const listItemDepth = enclosingListItemDepth(view, dropPos.pos)
  let slice = view.state.selection.content()
  let content = slice.content

  if (listItemDepth === null || listItemDepth !== view.state.doc.resolve(dropPos.pos).depth) {
    content = flattenList(content, view.state.schema)
  }

  if (listItemDepth === null) {
    const listNode =
      listTypeForSelection(view) === "orderedList"
        ? view.state.schema.nodes.orderedList
        : view.state.schema.nodes.bulletList

    if (listNode) content = Fragment.from(listNode.create(null, content))
  }

  view.dragging = {
    slice: new Slice(content, slice.openStart, slice.openEnd),
    move: !event.ctrlKey,
  }

  return false
}

function hasBlockDragData(event: DragEvent) {
  return (
    Array.from(event.dataTransfer?.types ?? []).includes(EDITOR_BLOCK_DRAG_MIME) ||
    Boolean(activeDragPayload)
  )
}

export function createEditorDragDrop(
  setDropLine: (line: BlockDropLine | null) => void,
  bridge: DragDropBridge,
) {
  const onDragOver = (view: EditorView, event: DragEvent) => {
    const isBlockDrag = hasBlockDragData(event)
    const isPageDrag = bridge.isDraggingPage(event)

    if (!isBlockDrag && !isPageDrag) {
      setDropLine(null)
      return false
    }

    const skipDropLine = bridge.shouldSkipDropLine(event)
    const overDatabaseDrop = bridge.isOverDatabaseDrop(event)

    if (!skipDropLine && !overDatabaseDrop) {
      setDropLine(getEditorInsertDropTarget(view, event)?.line ?? null)
    } else {
      setDropLine(null)
    }

    if (overDatabaseDrop && isPageDrag) {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
      return false
    }

    if (skipDropLine) return false

    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = isBlockDrag ? "move" : "copy"

    return false
  }

  const onDrop = (view: EditorView, event: DragEvent) => {
    setDropLine(null)
    if (bridge.dropPageOnDatabase(event)) return true

    const payload = parsePayload(event.dataTransfer)
    if (payload && !isListItemType(payload.typeName)) {
      const target = getEditorInsertDropTarget(view, event)
      if (target && dropBlock(view, event, target.pos)) return true
    }

    if (bridge.insertDraggedPage(view, event)) return true
    return prepareListDrop(view, event)
  }

  const onLeave = (container: Node | null, event: DragEvent) => {
    if (
      container &&
      event.relatedTarget instanceof Node &&
      container.contains(event.relatedTarget)
    ) {
      return
    }

    setDropLine(null)
  }

  return {
    handleDrop: onDrop,
    domEvents: {
      dragover: onDragOver,
      dragend: (view: EditorView) => {
        setDropLine(null)
        resetDragSession(view)
        return false
      },
      dragleave: (view: EditorView, event: DragEvent) => {
        onLeave(view.dom, event)
        return false
      },
    },
    surfaceProps: {
      onDragEnd: () => {
        setDropLine(null)
        resetDragSession(bridge.getView())
      },
      onDragLeave: (event: ReactDragEvent<HTMLElement>) =>
        onLeave(bridge.surfaceRef?.current ?? null, event.nativeEvent),
      onDragOver: (event: ReactDragEvent<HTMLElement>) => {
        const view = bridge.getView()
        if (view) onDragOver(view, event.nativeEvent)
      },
      onDrop: (event: ReactDragEvent<HTMLElement>) => {
        const view = bridge.getView()
        if (!view || (event.target instanceof Node && view.dom.contains(event.target))) return

        onDrop(view, event.nativeEvent)
      },
    },
  }
}
