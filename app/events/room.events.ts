// ========================================
// Room Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  RoomLevelUpPayload,
  RoomParticipantCountPayload,
  RoomUpdatedPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomEvents]')

/**
 * Composable to register room-level socket event handlers.
 * Captures store and toast dependencies during setup() phase.
 */
export function useRoomEvents() {
  const roomStore = useRoomStore()
  const toast = useToast()
  const { handleRoomUpdated } = useRoomSettingsHandler()

  return function registerRoomEvents(socket: Socket): void {
    socket.on('room.level_up', (payload: RoomLevelUpPayload) => {
      // Update room if it's the current room
      if (roomStore.currentRoom?.id === payload.room_id) {
        roomStore.updateRoomLevel(payload.new_level, payload.current_xp)
      }
      toast.add({
        title: 'Room Level Up!',
        description: `${payload.room_name} is now Level ${payload.new_level}!`,
        color: 'success',
      })
    })

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

