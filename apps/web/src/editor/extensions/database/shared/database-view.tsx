import { Loader2 } from "lucide-react"

import { DatabaseViewContent } from "./database-view-content"
import { DatabaseViewProvider } from "./database-view-context"
import { DatabaseViewToolbar } from "./database-view-toolbar"
import {
  useDatabaseViewController,
  type DatabaseViewProps,
} from "./use-database-view-controller"

export type { DatabaseViewProps }

export function DatabaseView(props: DatabaseViewProps) {
  const {
    className,
    context,
    databaseId,
    handleDatabaseBlockDragOver,
    handleDatabaseBlockDrop,
    isLoading,
    payload,
    viewType,
  } = useDatabaseViewController(props)

  return (
    <DatabaseViewProvider value={context}>
      <div
        className={className}
        contentEditable={false}
        onDragOver={handleDatabaseBlockDragOver}
        onDrop={handleDatabaseBlockDrop}
      >
        <div className="database-toolbar-section">
          <DatabaseViewToolbar />
        </div>
        <div className="database-scroll-section">
          {!databaseId ? (
            <div className="database-empty-state">
              <span>Database reference missing.</span>
            </div>
          ) : isLoading || !payload ? (
            <div className="database-empty-state">
              <Loader2 className="animate-spin" />
              <span>Loading database...</span>
            </div>
          ) : (
            <DatabaseViewContent viewType={viewType} />
          )}
        </div>
      </div>
    </DatabaseViewProvider>
  )
}
