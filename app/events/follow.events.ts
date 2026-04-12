// ========================================
// Follow Events
// ========================================
// Handles user.followed and user.unfollowed socket events.
// REACT-only: updates UI via toasts. No business logic.

import type { Socket } from 'socket.io-client'
import { createLogger } from '~/utils/logger'

const log = createLogger('[FollowEvents]')

// ========================================
// Payload Types
// ========================================

interface UserFollowedPayload {
  follower: {
    id: number
    name: string
    avatar: string | null
  }
  followed_at: string
}

interface UserUnfollowedPayload {
  follower_id: number
}

// ========================================
// Registration
// ========================================

/**
 * Composable to register follow-related socket event handlers.
 * Captures toast dependencies during setup() phase.
 */
export function useFollowEvents() {
  const toast = useToast()

  return function registerFollowEvents(socket: Socket): void {
    socket.on('user.followed', (payload: UserFollowedPayload) => {
      log.debug('user.followed', payload)

      toast.add({
        title: 'New Follower!',
        description: `${payload.follower.name} started following you`,
        color: 'success',
        icon: 'i-lucide-user-plus',
      })
    })

    socket.on('user.unfollowed', (payload: UserUnfollowedPayload) => {
      log.debug('user.unfollowed', payload)
      // Silent — no toast for unfollows to avoid negativity
    })
  }
}
