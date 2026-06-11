import { DatabaseKanbanView } from "../kanban/database-kanban-view"
import { DatabaseTableView } from "../table"

type DatabaseViewContentProps = {
  viewType?: string
}

export function DatabaseViewContent({ viewType }: DatabaseViewContentProps) {
  return viewType === "kanban" ? (
    <DatabaseKanbanView />
  ) : (
    <DatabaseTableView />
  )
}
