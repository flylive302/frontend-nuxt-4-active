/**
 * Action composable for Recharge Activity missions.
 *
 * Handles milestone claiming: GATE → EXECUTE → REACT.
 * State is stored in useMissionStore; this composable owns the mutation path.
 */

import { useApi } from '~/composables/shared/useApi'
import { useMissionStore } from '~/stores/mission'
import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionActions]')

export function useMissionActions() {
  const { api, normalizeError } = useApi()
  const store = useMissionStore()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const claimingMilestoneId = ref<number | null>(null)

  // ========================================
  // EXECUTE
  // ========================================

  async function claimMilestone(timeframe: string, milestoneId: number): Promise<void> {
    // GATE — prevent concurrent claims
    if (claimingMilestoneId.value !== null) return

    const milestone = store.progressFor(timeframe)?.milestones.find(m => m.id === milestoneId)
    if (!milestone || milestone.state !== 'claimable') return

    claimingMilestoneId.value = milestoneId

    try {
      // EXECUTE
      await api(`/missions/recharge/${timeframe}/milestones/${milestoneId}/claim`, {
        method: 'POST',
      })

      // REACT — optimistic update: flip to claimed immediately
      store.setMilestoneState(timeframe, milestoneId, 'claimed')

      toast.add({
        title: 'Reward Claimed!',
        description: 'Your rewards have been granted.',
        color: 'success',
        icon: 'i-lucide-gift',
      })
    } catch (err) {
      // REACT (error surface)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Claim Failed',
        description: normalized.message,
        color: 'error',
      })
      log.warn('Failed to claim milestone', { milestoneId, err })
    } finally {
      claimingMilestoneId.value = null
    }
  }

  return { claimMilestone, claimingMilestoneId: readonly(claimingMilestoneId) }
}
