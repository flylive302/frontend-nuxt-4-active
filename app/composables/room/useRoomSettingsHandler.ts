// ========================================
// Room Settings Handler Composable
// ========================================
// Role: Event Handler / Reactor — processes room.updated relay events.
// Owns the business logic that the events layer delegates to.
// Per ARCHITECTURE.md: "Events are REACT handlers … No business logic."

import type { RoomUpdatedPayload } from '~/types/room/socket-events'


// ========================================
// Constants
// ========================================

/**
 * Security-sensitive fields that should trigger disconnection of non-owner users
 * when changed. Room type changes (public↔private) or password changes invalidate
 * the access grant of current participants.
 */
const SECURITY_FIELDS = ['type', 'password'] as const

// ========================================
// Composable
// ========================================

/**
 * Handles business logic for room.updated relay events.
 * Called by room.events.ts — keeps the events layer thin.
 */
export function useRoomSettingsHandler() {
  const roomStore = useRoomStore()
  const roomSessionStore = useRoomSessionStore()
  const roomSession = useRoomSession()
  const authStore = useAuthStore()
  const seatsStore = useRoomSeatsStore()
  const toast = useToast()

  /**
   * Handle room.updated event.
   *
   * GATE: check if event applies to current room
   * EXECUTE: merge updated fields or disconnect if security changed
   * REACT: show toast for security disconnection
   */
  function handleRoomUpdated(payload: RoomUpdatedPayload): void {
    if (roomStore.currentRoom?.id !== payload.room.id) return

    // GATE — detect security-sensitive changes
    const securityChanged = payload.updated_fields.some(
      f => (SECURITY_FIELDS as readonly string[]).includes(f),
    )

    // EXECUTE — disconnect non-owner if security changed
    if (securityChanged && payload.updated_by !== authStore.user?.id) {
      roomSession.leaveRoom()
      const target = roomSessionStore.previousRoute && !roomSessionStore.previousRoute.startsWith('/room/')
        ? roomSessionStore.previousRoute
        : '/'
      navigateTo(target, { replace: true })

      // REACT — notify user
      toast.add({
        title: 'Room settings changed',
        description: 'The room security settings were updated. You have been disconnected.',
        color: 'warning',
      })
      return
    }

    // EXECUTE — merge updated fields while preserving owner (not in relay payload)
    const preserved = {
      owner: roomStore.currentRoom.owner,
      owner_id: roomStore.currentRoom.owner_id,
    }
    Object.assign(roomStore.currentRoom, payload.room, preserved)

    // EXECUTE — resize the seat array to a live max_seats change (realtime-12),
    // so seats added beyond the previous count exist before occupancies target
    // them. The seats grid re-renders reactively off the same max_seats.
    if (payload.updated_fields.includes('max_seats')) {
      seatsStore.setSeatCount(payload.room.max_seats)
    }
  }

  return {
    handleRoomUpdated,
  }
}
