import { useCallback } from "react"
import { useAddDatabaseRow, useCreateDatabase } from "@notelab/features/databases"
import { toast } from "sonner"
import { dropPageOnDatabase } from "./database-page-drag"

export const useEditorDatabaseActions = (
  organizationId?: string | null,
  workspaceId?: string | null
) => {
  const createDatabase = useCreateDatabase()
  const addDatabaseRow = useAddDatabaseRow()

  const createEditorDatabase = useCallback(async () => {
    if (!organizationId || !workspaceId) return null
    const payload = await createDatabase.mutateAsync({
      name: "New database",
      organizationId,
      pageId: workspaceId,
    })
    return payload.database.id
  }, [createDatabase, organizationId, workspaceId])

  const handleDatabasePageDrop = useCallback(
    (event: DragEvent) =>
      dropPageOnDatabase(event, {
        addDatabaseRow,
        onError: (message) => toast.error(message),
      }),
    [addDatabaseRow]
  )

  return { createEditorDatabase, handleDatabasePageDrop }
}
