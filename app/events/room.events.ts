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
 *
 * Events layer responsibilities (ARCHITECTURE.md):
 * - socket.on() registration
 * - Store mutations (simple field updates)
 * - Toast notifications
 * No business logic — complex handling delegates to composables.
 */
export function registerRoomEvents(socket: Socket): void {
  const roomStore = useRoomStore()
  const toast = useToast()

  socket.on('room.level_up', (payload: RoomLevelUpPayload) => {
    log.debug('room.level_up', payload)
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
    log.debug('room.participant_count', payload)
    // Update room store participant count if in a room
    if (roomStore.currentRoom) {
      roomStore.updateParticipantCount(payload.count)
    }
  })

  socket.on('room.updated', (payload: RoomUpdatedPayload) => {
    log.debug('room.updated', payload)
    // Security logic + merge logic lives in composable (ARCHITECTURE.md)
    const { handleRoomUpdated } = useRoomSettingsHandler()
    handleRoomUpdated(payload)
  })
}

