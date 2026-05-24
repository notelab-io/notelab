import { queryOptions } from "@tanstack/react-query"

import { ApiError, apiFetch } from "@/lib/api"

export type Organization = {
  id: string
  name: string
  slug: string
  logo?: string | null
  metadata?: string | null
}

export const organizationsQueryKey = ["organizations"] as const

export const organizationsQueryOptions = queryOptions({
  queryKey: organizationsQueryKey,
  queryFn: async () => {
    try {
      return await apiFetch<Organization[]>("/api/auth/organization/list", {
        method: "GET",
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return []
      }

      throw error
    }
  },
})
