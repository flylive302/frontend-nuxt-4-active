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

// One in-flight GET /auth/user per process. Bootstrap (deferred after first
// paint) and a page mount (e.g. /profile) routinely overlap on cold start;
// both callers only need *a* fresh user, not their own request.
let inflight: Promise<void> | null = null

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
  function syncUser(): Promise<void> {
    if (!authStore.token) return Promise.resolve()
    if (inflight) return inflight
    inflight = run().finally(() => { inflight = null })
    return inflight
  }

  async function run(): Promise<void> {
    // The response is a snapshot taken server-side at request time. Any
    // seq-guarded balance push (`applyBalance`) that lands while we await is
    // newer than that snapshot; replacing the user wholesale would roll the
    // balance back until the next push. Remember where the seq was and, if it
    // moved, keep the store's balance fields instead of the response's.
    const seqAtStart = authStore.lastBalanceSeq

    try {
      const response = await api<{ data: BootstrapUser }>('/auth/user')
      if (!response?.data) return
      // Logged out (or switched user) while in flight — stale, drop it.
      if (!authStore.token) return

      let next = response.data
      const current = authStore.user
      if (current && authStore.lastBalanceSeq > seqAtStart) {
        next = {
          ...next,
          coins: current.coins,
          diamonds: current.diamonds,
          wealth_xp: current.wealth_xp,
          charm_xp: current.charm_xp,
        }
      }

      authStore.setUser(next)
      badgesStore.setEquippedBadges(response.data.equipped_badges)
      badgesStore.setBadgeSlotLimit(response.data.badge_slot_limit)
    } catch (e) {
      log.warn('Failed to sync user data', e)
    }
  }

  return { syncUser }
}
