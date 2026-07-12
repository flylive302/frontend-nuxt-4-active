// ========================================
// Visitors List Composable
// ========================================
// Role: Data/Query — fetch a paginated page of the authenticated user's
// profile visitors. Own-profile only (backend scopes to `me`). Mirrors
// useFollowsList's client/error normalization so pages branch identically.

import type { VisitorUser } from '~/types/user/bootstrap'

export interface VisitorsPage {
  data: VisitorUser[]
  nextCursor: string | null
}

export function useVisitorsList() {
  const { api, normalizeError } = useApi()

  /** Fetch one page of the current user's profile visitors (cursor-paginated). */
  async function fetchPage(cursor: string | null): Promise<VisitorsPage> {
    const params = new URLSearchParams({ per_page: '20' })
    if (cursor) params.set('cursor', cursor)

    const response = await api<{
      status: string
      data: VisitorUser[]
      meta: { pagination: { next_cursor: string | null } }
    }>(`/users/me/visitors?${params}`)

    return {
      data: response.data,
      nextCursor: response.meta?.pagination?.next_cursor ?? null,
    }
  }

  return { fetchPage, normalizeError }
}
