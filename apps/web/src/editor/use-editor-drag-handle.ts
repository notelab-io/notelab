import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { Editor as TiptapEditor } from "@tiptap/react"
import {
  getBlockDragHandleRect,
  resolveBlockDragTargetFromPoint,
} from "@/packages/editor/components/editor/block-drag"
import type { DragHandleState } from "./types"

export const useEditorDragHandle = (
  editor: TiptapEditor | null,
  dragHandleMenuOpen: boolean
) => {
  const dragHandleRef = useRef<DragHandleState | null>(null)
  const [dragHandle, setDragHandle] = useState<DragHandleState | null>(null)

  const resolveDragTargetFromPoint = useCallback(
    (clientX: number, clientY: number) =>
      editor
        ? resolveBlockDragTargetFromPoint({
            clientX,
            clientY,
            currentTarget: dragHandleRef.current?.target ?? null,
            view: editor.view,
          })
        : null,
    [editor]
  )

  const clearDesktopDragHandle = useCallback(() => {
    dragHandleRef.current = null
    setDragHandle(null)
  }, [])

  const showDesktopDragHandle = useCallback((nextHandle: DragHandleState) => {
    const current = dragHandleRef.current
    if (
      current?.target.pos === nextHandle.target.pos &&
      current.target.node === nextHandle.target.node &&
      current.position.left === nextHandle.position.left &&
      current.position.top === nextHandle.position.top
    ) {
      return
    }
    dragHandleRef.current = nextHandle
    setDragHandle(nextHandle)
  }, [])

  const updateDragTargetFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (dragHandleMenuOpen || !editor) return
      const nextTarget = resolveDragTargetFromPoint(event.clientX, event.clientY)
      if (!nextTarget) return clearDesktopDragHandle()
      const position = getBlockDragHandleRect(editor.view, nextTarget)
      if (!position) return clearDesktopDragHandle()
      showDesktopDragHandle({ position, target: nextTarget })
    },
    [
      clearDesktopDragHandle,
      dragHandleMenuOpen,
      editor,
      resolveDragTargetFromPoint,
      showDesktopDragHandle,
    ]
  )

  useEffect(() => {
    if (dragHandleMenuOpen) return
    const handleScroll = () => clearDesktopDragHandle()
    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [clearDesktopDragHandle, dragHandleMenuOpen])

  return {
    dragHandle,
    clearDesktopDragHandle,
    resolveDragTargetFromPoint,
    updateDragTargetFromPointer,
  }
}