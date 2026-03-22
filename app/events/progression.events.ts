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
 */
export function registerProgressionEvents(socket: Socket): void {
  socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
    log.debug('badge.earned', payload)
    // Show celebratory modal with animation
    const { showBadgeEarned } = useAchievementModals()
    showBadgeEarned(payload)
  })

  socket.on('level.up', (payload: UserLevelUpPayload) => {
    log.debug('level.up', payload)
    // Update levels store with new level
    const { updateWealthLevel, updateCharmLevel } = useLevelActions()
    if (payload.type === 'wealth') {
      updateWealthLevel(payload.new_level, payload.current_xp)
    } else {
      updateCharmLevel(payload.new_level, payload.current_xp)
    }
    // Show celebratory modal with animation
    const { showLevelUp } = useAchievementModals()
    showLevelUp(payload)
  })
}
