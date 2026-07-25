// ========================================
// Follows List Composable
// ========================================
// Role: Data/Query — fetch a paginated page of a user's followers/following.
// Pages own the list/cursor state and call fetchPage(); they never touch
// useApi directly. normalizeError is re-exposed so callers can branch on the
// HTTP status (e.g. 403 → restricted) without importing useApi themselves.

import type { FollowListUser } from '~/types/user/bootstrap'

export type FollowsKind = 'followers' | 'following'

export interface FollowsPage {
  data: FollowListUser[]
  nextCursor: string | null
}

export function useFollowsList() {
  const { api, normalizeError } = useApi()

  /** Fetch one page of followers/following for a user (cursor-paginated). */
  async function fetchPage(kind: FollowsKind, userId: number, cursor: string | null): Promise<FollowsPage> {
    const params = new URLSearchParams({ per_page: '20' })
    if (cursor) params.set('cursor', cursor)

    const response = await api<{
      status: string
      data: FollowListUser[]
      meta: { pagination: { next_cursor: string | null } }
    }>(`/users/${userId}/${kind}?${params}`)

    return {
      data: response.data,
      nextCursor: response.meta?.pagination?.next_cursor ?? null,
    }
  }

  return { fetchPage, normalizeError }
}
