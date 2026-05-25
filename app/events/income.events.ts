// ========================================
// Income Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { IncomeTargetCompletedPayload } from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[IncomeEvents]')

/**
 * Composable to register income-related socket event handlers.
 * Captures modal dependencies during setup() phase.
 */
export function useIncomeEvents() {
  const { showIncomeTargetCompleted } = useAchievementModals()

  return function registerIncomeEvents(socket: Socket): void {
    socket.on('income_target.completed', (payload: IncomeTargetCompletedPayload) => {
      // Show celebratory modal with animation (same style as level up)
      showIncomeTargetCompleted(payload, false)
    })

    socket.on('income_target.member_completed', (payload: IncomeTargetCompletedPayload) => {
      // Show celebratory modal for owner
      showIncomeTargetCompleted(payload, true)
    })
  }
}
