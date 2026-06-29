import { DatabaseKanbanView } from "../kanban/database-kanban-view"
import { DatabaseTableView } from "../table"
import { DatabaseTimelineView } from "../timeline/database-timeline-view"

type DatabaseViewContentProps = {
  viewType?: string
}

export function DatabaseViewContent({ viewType }: DatabaseViewContentProps) {
  if (viewType === "kanban") {
    return <DatabaseKanbanView />
  }

  if (viewType === "timeline") {
    return <DatabaseTimelineView />
  }

  return <DatabaseTableView />
}
