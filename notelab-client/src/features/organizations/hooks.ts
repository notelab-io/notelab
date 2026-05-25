import { useMutation, useQuery } from "@tanstack/react-query"

import { authFetch } from "@/lib/api"
import { queryClient } from "@/lib/query-client"
import { sessionQueryKey } from "@/features/auth/queries"
import { refreshSession } from "@/features/auth/hooks"
import {
  organizationsQueryKey,
  organizationsQueryOptions,
  type Organization,
} from "@/features/organizations/queries"
import { useAppStore } from "@/stores/app-store"

export function useOrganizations() {
  return useQuery(organizationsQueryOptions)
}

export function useCreateOrganization() {
  const setActiveOrganizationId = useAppStore((state) => state.setActiveOrganizationId)

  return useMutation({
    mutationFn: (name: string) =>
      authFetch<Organization>("/organization/create", {
        name,
        slug: createSlug(name),
      }),
    onSuccess: async (organization) => {
      setActiveOrganizationId(organization.id)
      await authFetch("/organization/set-active", {
        organizationId: organization.id,
      })
      await queryClient.invalidateQueries({ queryKey: organizationsQueryKey })
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
      await refreshSession()
    },
  })
}

export function useSetActiveOrganization() {
  const setActiveOrganizationId = useAppStore((state) => state.setActiveOrganizationId)

  return useMutation({
    mutationFn: (organizationId: string) =>
      authFetch("/organization/set-active", {
        organizationId,
      }),
    onSuccess: async (_result, organizationId) => {
      setActiveOrganizationId(organizationId)
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
      await refreshSession()
    },
  })
}

function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug ? `${slug}-${Date.now().toString(36)}` : `workspace-${Date.now().toString(36)}`
}
