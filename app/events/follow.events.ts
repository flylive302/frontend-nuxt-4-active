// ========================================
// Follow Events
// ========================================
// Handles user.followed and user.unfollowed socket events.
// REACT-only: updates UI via toasts. No business logic.

import type { Socket } from 'socket.io-client'


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

// ========================================
// Registration
// ========================================

/**
 * Composable to register follow-related socket event handlers.
 * Captures toast dependencies during setup() phase.
 */
export function useFollowEvents() {
  const toast = useToast()
  const authStore = useAuthStore()

  return function registerFollowEvents(socket: Socket): void {
    socket.on('user.followed', (payload: UserFollowedPayload) => {

      // Increment MY followers_count (REACT store update)
      authStore.incrementFollowers()

      toast.add({
        title: 'New Follower!',
        description: `${payload.follower.name} started following you`,
        color: 'success',
        icon: 'i-lucide-user-plus',
      })
    })

    socket.on('user.unfollowed', () => {

      // Decrement MY followers_count (REACT store update)
      authStore.decrementFollowers()

      // Silent — no toast for unfollows to avoid negativity
    })
  }
}
