// ========================================
// Income Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { IncomeTargetCompletedPayload } from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[IncomeEvents]')

/**
 * Register income-related socket event handlers.
 * Handles income target completions for both targets and members.
 */
export function registerIncomeEvents(socket: Socket): void {
  socket.on('income_target.completed', (payload: IncomeTargetCompletedPayload) => {
    log.debug('income_target.completed', payload)
    // Show celebratory modal with animation (same style as level up)
    const { showIncomeTargetCompleted } = useAchievementModals()
    showIncomeTargetCompleted(payload, false)
  })

  socket.on('income_target.member_completed', (payload: IncomeTargetCompletedPayload) => {
    log.debug('income_target.member_completed', payload)
    // Show celebratory modal for owner
    const { showIncomeTargetCompleted } = useAchievementModals()
    showIncomeTargetCompleted(payload, true)
  })
}
