// ========================================
// Progression Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BadgeEarnedPayload,
  UserProgressionPayload,
} from '~/types/room/socket-events'

/**
 * Composable to register progression-related socket event handlers.
 *
 * Celebration modals are no longer fired from here — they are page-gated
 * (level-up-celebrations epic). Level-up shows on /levels/wealth|charm via
 * useLevelUpDrain; the badge earns a toast; seat-cap unlocks are delivered as
 * a durable official inbox message from the backend. The old app-wide modal
 * queue (useAchievementModals), the `level.up` back-compat listener, and the
 * `room.seat_cap_unlocked` modal handler were removed with ticket 06.
 */
export function useProgressionEvents() {
  const { onBadgeEarned } = useBadgeActions()
  const { handleLevelUp } = useLevelActions()

  return function registerProgressionEvents(socket: Socket): void {
    // badge.earned: standalone badges (rewards, agency targets, events, admin
    // grants). onBadgeEarned updates the store and raises its own toast.
    socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
      onBadgeEarned({
        id: 0, // Temporary ID; real data will be fetched on next store refresh
        earned_at: new Date().toISOString(),
        source_type: 'reward_claim',
        badge: {
          id: payload.badge_id,
          name: payload.badge_name,
          description: '',
          image_url: payload.badge_image,
        },
      } as import('~/types/progression/badge').UserBadge)
    })

    // user.progression: single event from the gift side-effects job combining
    // all level-ups in one transaction for this user. Updates the auth store's
    // XP only; the celebration is derived page-side from XP + watermark.
    socket.on('user.progression', (payload: UserProgressionPayload) => {
      for (const levelUp of payload.level_ups) {
        handleLevelUp(levelUp)
      }
    })
  }
}
