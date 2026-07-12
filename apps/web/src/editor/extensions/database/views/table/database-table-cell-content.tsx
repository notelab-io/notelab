import {
  useEffect,
  type RefObject,
  type ReactNode,
} from "react"

import {
  getDatabaseHorizontalWheelDelta,
  preserveDatabaseScrollLeftOnVerticalWheel,
} from "../../interactions/database-wheel-scroll"

function handleDatabaseCellWheel(
  event: WheelEvent,
  scrollElement: HTMLDivElement
) {
  const horizontalDelta = getDatabaseHorizontalWheelDelta(event)
  const tableScrollElement = scrollElement.closest<HTMLDivElement>(
    ".database-table-scroll"
  )

  if (!horizontalDelta) {
    preserveDatabaseScrollLeftOnVerticalWheel(event, [
      scrollElement,
      tableScrollElement,
    ])
    return
  }

  const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth
  const preventCancelableDefault = () => {
    if (event.cancelable) {
      event.preventDefault()
    }
  }

  const scrollTable = (delta: number) => {
    if (!tableScrollElement) {
      return false
    }

    const tableMaxScrollLeft =
      tableScrollElement.scrollWidth - tableScrollElement.clientWidth
    const nextScrollLeft = Math.min(
      tableMaxScrollLeft,
      Math.max(0, tableScrollElement.scrollLeft + delta)
    )

    if (nextScrollLeft === tableScrollElement.scrollLeft) {
      return false
    }

    tableScrollElement.scrollLeft = nextScrollLeft
    return true
  }

  if (maxScrollLeft <= 1) {
    if (scrollTable(horizontalDelta)) {
      preventCancelableDefault()
      event.stopPropagation()
    }

    return
  }

  const previousScrollLeft = scrollElement.scrollLeft
  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, previousScrollLeft + horizontalDelta)
  )
  const consumedDelta = nextScrollLeft - previousScrollLeft
  const remainingDelta = horizontalDelta - consumedDelta

  scrollElement.scrollLeft = nextScrollLeft

  if (remainingDelta) {
    scrollTable(remainingDelta)
  }

  preventCancelableDefault()
  event.stopPropagation()
}

export function useDatabaseTableCellWheel(
  tableScrollRef: RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    const tableScrollElement = tableScrollRef.current

    if (!tableScrollElement) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const scrollElement = target.closest<HTMLDivElement>(
        "[data-database-cell-scroll]"
      )

      if (scrollElement && tableScrollElement.contains(scrollElement)) {
        handleDatabaseCellWheel(event, scrollElement)
      }
    }

    tableScrollElement.addEventListener("wheel", handleWheel, { passive: false })

    return () => tableScrollElement.removeEventListener("wheel", handleWheel)
  }, [tableScrollRef])
}

export function DatabaseTableCellContent({
  children,
  wrapContent = false,
}: {
  children: ReactNode
  wrapContent?: boolean
}) {
  return (
    <div
      className="database-cell-scroll"
      data-database-cell-scroll
      data-wrap-content={wrapContent ? "true" : "false"}
    >
      {children}
    </div>
  )
}
