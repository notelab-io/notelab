import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Building2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api"
import { useNotelabFeatures } from "@notelab/features"
import { useActiveOrganizationId } from "@notelab/features/integrations"
import {
  parseActiveOrganizationMismatchError,
  workspaceQueryKey,
  workspaceQueryOptions,
} from "@notelab/features/workspaces"
import { useOrganizations, useSetActiveOrganization } from "@notelab/features/organizations"

type WorkspaceOrganizationGateProps = {
  children: React.ReactNode
  workspaceId: string
}

export function WorkspaceOrganizationGate({
  children,
  workspaceId,
}: WorkspaceOrganizationGateProps) {
  const { apiFetch, queryClient } = useNotelabFeatures()
  const activeOrganizationId = useActiveOrganizationId()
  const { data: organizations = [] } = useOrganizations()
  const setActiveOrganization = useSetActiveOrganization()
  const query = useQuery({
    ...workspaceQueryOptions(apiFetch, workspaceId),
    retry: (failureCount, error) => {
      if (parseActiveOrganizationMismatchError(error)) {
        return false
      }

      return failureCount < 2
    },
  })
  const mismatch = parseActiveOrganizationMismatchError(query.error)
  const workspaceOrganizationId = query.data?.workspace?.organizationId
  const hasClientMismatch = Boolean(
    workspaceOrganizationId &&
      activeOrganizationId &&
      workspaceOrganizationId !== activeOrganizationId,
  )
  const requiredOrganizationId =
    mismatch?.organizationId ?? (hasClientMismatch ? workspaceOrganizationId : null)
  const organization = organizations.find(
    (item) => item.id === requiredOrganizationId,
  )
  const organizationLabel = organization?.name?.trim() || "this organization"

  const handleSwitchOrganization = React.useCallback(async () => {
    if (!requiredOrganizationId) {
      return
    }

    await setActiveOrganization.mutateAsync(requiredOrganizationId)
    await queryClient.invalidateQueries({
      queryKey: workspaceQueryKey(workspaceId),
    })
  }, [queryClient, requiredOrganizationId, setActiveOrganization, workspaceId])

  if (requiredOrganizationId) {
    return (
      <>
        <div className="min-h-[calc(100svh-3rem)] flex-1" />
        <AlertDialog open>
          <AlertDialogContent size="default" className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Building2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>Switch organization</AlertDialogTitle>
              <AlertDialogDescription>
                This workspace belongs to {organizationLabel}. Switch to that
                organization to open it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </AlertDialogCancel>
              <Button
                disabled={setActiveOrganization.isPending}
                onClick={() => {
                  void handleSwitchOrganization()
                }}
              >
                {setActiveOrganization.isPending
                  ? "Switching..."
                  : "Switch organization"}
              </Button>
            </AlertDialogFooter>
            {setActiveOrganization.error ? (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(setActiveOrganization.error)}
              </p>
            ) : null}
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  if (query.isPending) {
    return null
  }

  return children
}