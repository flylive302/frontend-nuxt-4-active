// ========================================
// User Search Composable
// ========================================

import { ref } from 'vue'
import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Types
// ========================================

export interface SearchUsersParams {
  search: string
  per_page?: number
  cursor?: string | null
}

export interface UserSearchResult {
  data: MinimalUser[]
  meta: {
    path: string
    per_page: number
    next_cursor: string | null
    prev_cursor: string | null
  }
}

// ========================================
// Composable
// ========================================

export function useUserSearch() {
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================

  const users = ref<MinimalUser[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(false)
  const cursor = ref<string | null>(null)

  // ========================================
  // Actions
  // ========================================

  /**
   * Search for users by ID, Name, or Signature.
   * @param query - The search query term
   * @param reset - Whether to reset the list (default: true for new search)
   */
  async function searchUsers(query: string, reset = true): Promise<void> {
    // Allow empty query to fetch "default" or "recent" users if backend supports it
    // if (!query.trim()) {
    //   users.value = []
    //   return
    // }

    if (reset) {
      users.value = []
      cursor.value = null
      hasMore.value = true
    }

    if (!hasMore.value && !reset) return

    loading.value = true
    error.value = null

    try {
      const params: SearchUsersParams = {
        search: query,
        per_page: 15,
      }
      
      if (cursor.value) {
        params.cursor = cursor.value
      }

      const response = await api<UserSearchResult>('/users/search', {
        method: 'GET',
        params,
      })

      const mappedUsers: MinimalUser[] = response.data.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        signature: u.signature,
        gender: u.gender,
        date_of_birth: u.date_of_birth,
        wealth_xp: u.wealth_xp,
        charm_xp: u.charm_xp,
        phone: u.phone,
        country: u.country,
        avatar: u.avatar,
        frame: u.frame,
      }))

      if (reset) {
        users.value = mappedUsers
      } else {
        users.value.push(...mappedUsers)
      }

      cursor.value = response.meta.next_cursor
      hasMore.value = response.meta.next_cursor !== null
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      console.error('[useUserSearch] searchUsers failed:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Load the next page of results for the current query.
   * @param query - The current search query
   */
  async function loadMore(query: string): Promise<void> {
    await searchUsers(query, false)
  }

  return {
    users,
    loading,
    error,
    hasMore,
    searchUsers,
    loadMore,
  }
}
