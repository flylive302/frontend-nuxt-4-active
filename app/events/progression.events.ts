// ========================================
// Progression Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BadgeEarnedPayload,
  UserLevelUpPayload,
  UserProgressionPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[ProgressionEvents]')

/**
 * Composable to register progression-related socket event handlers.
 * Captures action and modal dependencies during setup() phase.
 */
export function useProgressionEvents() {
  const { onBadgeEarned } = useBadgeActions()
  const { showBadgeEarned, showLevelUp } = useAchievementModals()
  const { handleLevelUp } = useLevelActions()

  return function registerProgressionEvents(socket: Socket): void {
    // badge.earned: standalone badges (rewards, admin grants, etc.)
    // Gift-based level badges arrive via user.progression instead.
    socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
      log.debug('badge.earned', payload)
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
      showBadgeEarned(payload)
    })

    // level.up: kept for backward compatibility; not emitted by the gift job anymore.
    socket.on('level.up', (payload: UserLevelUpPayload) => {
      log.debug('level.up', payload)
      handleLevelUp(payload)
      showLevelUp(payload)
    })

    // user.progression: single event from the gift side-effects job combining
    // all level-ups and badges earned in one transaction for this user.
    socket.on('user.progression', (payload: UserProgressionPayload) => {
      log.debug('user.progression', payload)

      for (const levelUp of payload.level_ups) {
        handleLevelUp(levelUp)
        showLevelUp(levelUp)
      }

      for (const badge of payload.badges) {
        onBadgeEarned({
          id: 0,
          badge_id: badge.badge_id,
          is_displayed: false,
          earned_at: new Date().toISOString(),
          badge: {
            id: badge.badge_id,
            name: badge.badge_name,
            image_url: badge.badge_image,
            category: badge.category,
          },
        } as import('~/types/progression/badge').UserBadge)
      }
    })
  }
}
