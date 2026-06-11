import {
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react"

function handleDatabaseCellWheel(event: ReactWheelEvent<HTMLDivElement>) {
  const horizontalDelta =
    Math.abs(event.deltaX) > 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0

  if (!horizontalDelta) {
    return
  }

  const scrollElement = event.currentTarget
  const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth
  const tableScrollElement = scrollElement.closest<HTMLDivElement>(
    ".database-table-scroll"
  )

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
      event.preventDefault()
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

  event.preventDefault()
  event.stopPropagation()
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
      onWheel={handleDatabaseCellWheel}
    >
      {children}
    </div>
  )
}
