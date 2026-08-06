// ========================================
// Room Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  RoomParticipantCountPayload,
  RoomUpdatedPayload,
} from '~/types/room/socket-events'


/**
 * Composable to register room-level socket event handlers.
 * Captures store dependencies during setup() phase.
 */
export function useRoomEvents() {
  const roomStore = useRoomStore()
  const { handleRoomUpdated } = useRoomSettingsHandler()

  return function registerRoomEvents(socket: Socket): void {
    socket.on('room.participant_count', (payload: RoomParticipantCountPayload) => {
      // Update room store participant count if in a room
      if (roomStore.currentRoom) {
        roomStore.updateParticipantCount(payload.count)
      }
    })

    socket.on('room.updated', (payload: RoomUpdatedPayload) => {
      // Security logic + merge logic lives in composable (ARCHITECTURE.md)
      handleRoomUpdated(payload)
    })
  }
}

