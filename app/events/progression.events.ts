// ========================================
// Progression Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BadgeEarnedPayload,
  UserLevelUpPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[ProgressionEvents]')

/**
 * Register progression-related socket event handlers.
 * Handles badge earned and level up celebrations.
 *
 * Events layer responsibilities (ARCHITECTURE.md):
 * - socket.on() registration
 * - Store mutations (via composable)
 * - Toast notifications
 * No business logic (routing decisions belong in the composable).
 */
export function registerProgressionEvents(socket: Socket): void {
  socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
    log.debug('badge.earned', payload)
    const { showBadgeEarned } = useAchievementModals()
    showBadgeEarned(payload)
  })

  socket.on('level.up', (payload: UserLevelUpPayload) => {
    log.debug('level.up', payload)
    // Routing (wealth vs charm) is business logic — lives in the composable
    const { handleLevelUp } = useLevelActions()
    handleLevelUp(payload)
    // Show celebratory modal (REACT side effect)
    const { showLevelUp } = useAchievementModals()
    showLevelUp(payload)
  })
}
