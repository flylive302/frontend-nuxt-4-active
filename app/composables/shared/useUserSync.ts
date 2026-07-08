// ========================================
// User Sync Composable
// ========================================
// Role: Data/Query — re-fetch the authenticated user and seed auth-scoped stores.
//
// Shared by two callers:
//  1. Bootstrap (initial hydrate on app start).
//  2. Socket reconnect (self-heal). The Laravel→MSAB realtime bridge is
//     at-most-once with NO replay: a `balance.updated` (or profile/badge) event
//     routed while the socket is briefly disconnected is dropped for good, and
//     only a fresh fetch reconciles it. Re-syncing on every reconnect closes
//     that gap without forcing the user to refresh the page.

import type { BootstrapUser } from '~/types/user/bootstrap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[UserSync]')

export function useUserSync() {
  const { api } = useApi()
  const authStore = useAuthStore()
  const badgesStore = useBadgesStore()

  /**
   * Re-fetch the authenticated user and seed authStore + badges.
   *
   * GATE:    skip when unauthenticated (no token → nothing to sync).
   * EXECUTE: GET /auth/user, seed auth + badge stores (idempotent).
   * REACT:   errors are swallowed — a failed background sync must never surface
   *          to the user.
   */
  async function syncUser(): Promise<void> {
    if (!authStore.token) return

    try {
      const response = await api<{ data: BootstrapUser }>('/auth/user')
      if (response?.data) {
        authStore.setUser(response.data)
        badgesStore.setEquippedBadges(response.data.equipped_badges)
        badgesStore.setBadgeSlotLimit(response.data.badge_slot_limit)
      }
    } catch (e) {
      log.warn('Failed to sync user data', e)
    }
  }

  return { syncUser }
}
