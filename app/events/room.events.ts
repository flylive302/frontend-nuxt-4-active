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
 * Security-sensitive fields that should trigger disconnection of non-owner users
 * when changed. Room type changes (public↔private) or password changes invalidate
 * the access grant of current participants.
 */
const SECURITY_FIELDS = ['type', 'password'] as const

/**
 * Register room-level socket event handlers.
 * Handles room level ups, participant count updates, and settings changes.
 */
export function registerRoomEvents(socket: Socket): void {
  const roomStore = useRoomStore()
  const authStore = useAuthStore()
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
    if (roomStore.currentRoom?.id === payload.room.id) {
      // If security-sensitive fields changed, disconnect non-owner users.
      // Audio cleanup cascades automatically via useRoomLifecycle watcher
      // when currentRoom becomes null (same pattern as room:closed).
      const securityChanged = payload.updated_fields.some(
        f => (SECURITY_FIELDS as readonly string[]).includes(f),
      )
      if (securityChanged && payload.updated_by !== authStore.user?.id) {
        toast.add({
          title: 'Room settings changed',
          description: 'The room security settings were updated. You have been disconnected.',
          color: 'warning',
        })
        roomStore.leaveRoom()
        const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/')
          ? roomStore.previousRoute
          : '/'
        navigateTo(target, { replace: true })
        return
      }

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
