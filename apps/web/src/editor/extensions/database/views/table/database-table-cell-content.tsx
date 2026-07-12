import type { ReactNode } from "react"

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
