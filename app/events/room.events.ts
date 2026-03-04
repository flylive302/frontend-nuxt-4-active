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
 * Register room-level socket event handlers.
 * Handles room level ups, participant count updates, and settings changes.
 */
export function registerRoomEvents(socket: Socket): void {
  const roomStore = useRoomStore()

  socket.on('room.level_up', (payload: RoomLevelUpPayload) => {
    log.debug('room.level_up', payload)
    // Update room if it's the current room
    if (roomStore.currentRoom?.id === payload.room_id) {
      roomStore.updateRoomLevel(payload.new_level, payload.current_xp)
    }
    useToast().add({
      title: 'Room Level Up!',
      description: `${payload.room_name} is now Level ${payload.new_level}!`,
      color: 'success',
    })
  })

  socket.on('room.participant_count', (payload: RoomParticipantCountPayload) => {
    log.debug('room.participant_count', payload)
    // Update room store participant count if in a room
    if (roomStore.currentRoom) {
      roomStore.updateParticipantCount(payload.count)
    }
  })

  socket.on('room.updated', (payload: RoomUpdatedPayload) => {
    log.debug('room.updated', payload)
    if (roomStore.currentRoom?.id === payload.room.id) {
      // Merge updated fields while preserving owner (not in relay payload)
      const preserved = {
        owner: roomStore.currentRoom.owner,
        owner_id: roomStore.currentRoom.owner_id,
      }
      Object.assign(roomStore.currentRoom, payload.room, preserved)
      log.info('Room settings updated:', payload.updated_fields)
    }
  })
}
