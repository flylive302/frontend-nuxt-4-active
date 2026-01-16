// ========================================
// User Search Composable
// ========================================

import { ref } from 'vue'
import type { MinimalUser } from '~/types/bootstrap'

// ========================================
// Types
// ========================================

export interface SearchUsersParams {
  search: string
  per_page?: number
  cursor?: string | null
}

interface ApiUser {
  id: number
  name: string
  phone: {
    raw: string
    formatted: string
    country: string
  }
  email: string
  signature: string
  avatar: string
}

/** Search result extends MinimalUser with contact fields */
export interface SearchUser extends Pick<MinimalUser, 'id' | 'name' | 'signature' | 'avatar'> {
  email: string
  phone: string
  phone_country: string
}

export interface UserSearchResult {
  data: ApiUser[]
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

  const users = ref<SearchUser[]>([])
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

      const mappedUsers: SearchUser[] = response.data.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        signature: u.signature,
        phone: u.phone.formatted,
        phone_country: u.phone.country,
        avatar: u.avatar,
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
