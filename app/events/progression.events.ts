// ========================================
// Progression Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BadgeEarnedPayload,
  UserLevelUpPayload,
  UserProgressionPayload,
} from '~/types/room/socket-events'


/**
 * Composable to register progression-related socket event handlers.
 * Captures action and modal dependencies during setup() phase.
 */
export function useProgressionEvents() {
  const { onBadgeEarned } = useBadgeActions()
  const { showBadgeEarned, showLevelUp } = useAchievementModals()
  const { handleLevelUp } = useLevelActions()

  return function registerProgressionEvents(socket: Socket): void {
    // badge.earned: standalone badges (rewards, agency targets, events, admin grants).
    // Level-ups no longer award badges, so this is the only badge-earned path.
    socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
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
      handleLevelUp(payload)
      showLevelUp(payload)
    })

    // user.progression: single event from the gift side-effects job combining
    // all level-ups in one transaction for this user. Level-ups no longer award
    // badges — the new level's image comes from the bootstrap level config, shown
    // by the level-up modal (badge system refactor).
    socket.on('user.progression', (payload: UserProgressionPayload) => {
      for (const levelUp of payload.level_ups) {
        handleLevelUp(levelUp)
        showLevelUp(levelUp)
      }
    })
  }
}
