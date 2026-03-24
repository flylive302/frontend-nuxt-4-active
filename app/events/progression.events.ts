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

    // REACT — update store + show toast via composable
    const { onBadgeEarned } = useBadgeActions()
    onBadgeEarned({
      id: 0, // Temporary ID; real data will be fetched on next store refresh
      badge_id: payload.badge_id,
      is_displayed: false,
      earned_at: new Date().toISOString(),
      badge: {
        id: payload.badge_id,
        name: payload.badge_name,
        image_url: payload.badge_image,
        category: payload.category,
      },
    } as import('~/types/progression/badge').UserBadge)

    // REACT — show celebratory modal
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
