// ========================================
// Income Events (REACT — socket → store + modal)
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  AgencyXpProgressPayload,
  AgencyMilestoneCrossedPayload,
  AgencyMilestoneMemberCrossedPayload,
} from '~/types/room/socket-events'

/**
 * Register agency-XP run socket handlers: live progress, milestone crossings
 * (member + owner). Socket → store mutation + celebration modal only.
 */
export function useIncomeEvents() {
  const incomeStore = useIncomeStore()
  const { fetchActiveRun } = useIncomeActions()
  const { showMilestoneCrossed } = useAchievementModals()

  return function registerIncomeEvents(socket: Socket): void {
    socket.on('agency_xp.progress', (payload: AgencyXpProgressPayload) => {
      const applied = incomeStore.applyXpProgress({
        run_id: payload.run_id,
        accumulated_xp: parseFloat(payload.accumulated_xp),
        current_tier: payload.current_tier,
        progress_percentage: payload.progress_percentage,
      })

      // A run the client hasn't loaded (lazily opened) — refetch rather than desync.
      if (!applied) {
        void fetchActiveRun()
      }
    })

    socket.on('agency_milestone.crossed', (payload: AgencyMilestoneCrossedPayload) => {
      incomeStore.onMilestoneCrossed({
        run_id: payload.run_id,
        current_tier: payload.current_tier,
      })

      const memberReward = payload.milestones.reduce((sum, m) => sum + m.member_diamond_reward, 0)
      const ownerReward = payload.milestones.reduce((sum, m) => sum + m.owner_diamond_reward, 0)

      showMilestoneCrossed({
        tier: payload.current_tier,
        memberReward,
        ownerReward,
        isOwnerView: false,
      })
    })

    socket.on('agency_milestone.member_crossed', (payload: AgencyMilestoneMemberCrossedPayload) => {
      const ownerReward = payload.milestones.reduce((sum, m) => sum + m.owner_reward, 0)

      showMilestoneCrossed({
        tier: payload.current_tier,
        memberReward: 0,
        ownerReward,
        isOwnerView: true,
      })
    })
  }
}
