// ========================================
// User Blocking Composable
// ========================================
// Role: Action — profile-level user block/unblock + list fetch.
// Pipeline: GATE (no self-block) → EXECUTE (api) → REACT (store + toast).
// Distinct from `useRoomBlocking` (room-scoped, duration-based kick/block).
// This is the Apple-1.2 "block a user" feature: once blocked, that user's
// chat lines are hidden for the blocker everywhere (see useUserBlocksStore).

import { createLogger } from '~/utils/logger'

interface BlockedUserItem {
  id: number
  name: string
  avatar: string | null
  signature: string | null
  blockedAt: string
}

interface BlockedUsersPage {
  items: BlockedUserItem[]
  total: number
  currentPage: number
  lastPage: number
}

/** ApiResponse::success envelope — the page lives under `data`. */
interface BlockedUsersResponse {
  data: BlockedUsersPage
}

const log = createLogger('[useUserBlocking]')

export function useUserBlocking() {
  const { api } = useApi()
  const toast = useToast()
  const store = useUserBlocksStore()
  const authStore = useAuthStore()

  /**
   * Fetch the full blocked-users list (paged) and replace the store's set.
   * Fire-and-forget friendly — swallows errors (REACT-only failure, no
   * user-facing feedback needed for a background bootstrap fetch).
   */
  async function fetchBlockedUsers(): Promise<void> {
    try {
      const ids: number[] = []
      let page = 1
      let lastPage = 1

      do {
        const res = await api<BlockedUsersResponse>('/profile/blocks', {
          query: { page },
        })
        const pageData = res.data
        ids.push(...(pageData?.items ?? []).map((item) => item.id))
        lastPage = pageData?.lastPage || 1
        page += 1
      } while (page <= lastPage)

      // REACT
      store.setBlocked(ids)
    } catch (err) {
      log.warn('Failed to fetch blocked users', err)
    }
  }

  /**
   * Block a user. Returns true on success.
   */
  async function blockUser(userId: number): Promise<boolean> {
    // GATE: no self-block
    if (userId === authStore.user?.id) {
      log.warn('Ignored attempt to self-block')
      return false
    }

    // EXECUTE
    try {
      await api(`/profile/blocks/${userId}`, { method: 'POST' })

      // REACT
      store.addBlocked(userId)
      toast.add({
        title: 'User blocked',
        description: "You won't see their messages anymore.",
        color: 'success',
      })
      return true
    } catch (err) {
      log.warn('Failed to block user', err)
      toast.add({ title: 'Could not block user', color: 'error' })
      return false
    }
  }

  /**
   * Unblock a user. Returns true on success.
   */
  async function unblockUser(userId: number): Promise<boolean> {
    // EXECUTE
    try {
      await api(`/profile/blocks/${userId}`, { method: 'DELETE' })

      // REACT
      store.removeBlocked(userId)
      toast.add({ title: 'User unblocked', color: 'success' })
      return true
    } catch (err) {
      log.warn('Failed to unblock user', err)
      toast.add({ title: 'Could not unblock user', color: 'error' })
      return false
    }
  }

  return { fetchBlockedUsers, blockUser, unblockUser }
}
