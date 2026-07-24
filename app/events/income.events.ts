// ========================================
// Income Events (REACT — socket → store)
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  AgencyXpProgressPayload,
  AgencyMilestoneCrossedPayload,
} from '~/types/room/socket-events'

/**
 * Register agency-XP run socket handlers: live progress + member milestone
 * crossings. Socket → store mutation only.
 *
 * Celebration modals are no longer fired here — they are page-gated on
 * /agency/my-income via useMilestoneDrain (level-up-celebrations, ticket 05).
 * The former `agency_milestone.member_crossed` (owner-view modal) handler was
 * dropped with that ticket: the owner-view crossing has no modal, and the
 * event carried no store mutation, so its listener is gone entirely.
 */
export function useIncomeEvents() {
  const incomeStore = useIncomeStore()
  const { fetchActiveRun } = useIncomeActions()

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
    })
  }
}
