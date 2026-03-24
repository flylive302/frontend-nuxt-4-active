// ========================================
// Badge Actions Composable (Action / Orchestrator Role)
// ========================================
// Handles mutating badge actions with GATE → EXECUTE → REACT pipeline.

import type { UserBadge } from '~/types/progression/badge'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BadgeActions]')

/**
 * Composable for badge actions (mutations).
 *
 * Responsibilities (ARCHITECTURE.md - Action/Orchestrator role):
 * - GATE: validate preconditions
 * - EXECUTE: optimistic update + API call + store write
 * - REACT: toast notifications (fire-and-forget)
 */
export function useBadgeActions() {
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const store = useBadgesStore()

  // ========================================
  // Toggle Display
  // ========================================

  /**
   * Toggle badge display status with optimistic update.
   *
   * GATE: not already toggling, badge exists
   * EXECUTE: optimistic update, API call
   * REACT: toast success/failure, rollback on error
   */
  async function toggleDisplay(userBadgeId: number): Promise<boolean> {
    // GATE
    if (store.isTogglingDisplay !== null) return false

    const badge = store.userBadges.items.find(b => b.id === userBadgeId)
    if (!badge) {
      store.setIsTogglingDisplay(null)
      return false
    }

    // EXECUTE — optimistic update
    store.setIsTogglingDisplay(userBadgeId)
    store.updateUserBadgeDisplay(userBadgeId, !badge.is_displayed)

    try {
      await api<{
        success: true
        data: { badge: UserBadge; displayed_count: number; max_display: number }
        message: string
      }>(`/user/badges/${userBadgeId}/toggle-display`, { method: 'POST' })

      // REACT — success toast
      toast.add({
        title: badge.is_displayed ? 'Badge Displayed' : 'Badge Hidden',
        color: 'success',
      })

      return true
    } catch (err) {
      // REACT — rollback + error toast
      store.updateUserBadgeDisplay(userBadgeId, !badge.is_displayed)

      const normalized = normalizeError(err)
      toast.add({
        title: 'Update Failed',
        description: normalized.message,
        color: 'error',
      })
      log.error('toggleDisplay failed:', err)

      return false
    } finally {
      store.setIsTogglingDisplay(null)
    }
  }

  // ========================================
  // Badge Earned Handler
  // ========================================

  /**
   * Handle a real-time badge earned event.
   * Called from the events layer.
   *
   * Orchestrates: EXECUTE → REACT
   */
  function onBadgeEarned(userBadge: UserBadge): void {
    executeBadgeEarned(userBadge)
    reactBadgeEarned(userBadge)
  }

  /** EXECUTE — update store state */
  function executeBadgeEarned(userBadge: UserBadge): void {
    store.addUserBadge(userBadge)
    store.incrementStatsTotal()
  }

  /** REACT — fire-and-forget notification */
  function reactBadgeEarned(userBadge: UserBadge): void {
    toast.add({
      title: 'New Badge Earned!',
      description: userBadge.badge.name,
      color: 'success',
      icon: 'i-lucide-award',
    })
  }

  // ========================================
  // Return
  // ========================================

  return {
    toggleDisplay,
    onBadgeEarned,
  }
}
