// ========================================
// Room Membership Events
// ========================================

import type { Socket } from 'socket.io-client'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomMembershipEvents]')

/**
 * Register room membership socket event handlers.
 * Handles member joins/leaves/kicks/bans, role changes, and join requests.
 */
export function registerRoomMembershipEvents(socket: Socket): void {
  const authStore = useAuthStore()
  const roomStore = useRoomStore()
  const membershipStore = useRoomMembershipStore()

  socket.on('room.member_joined', (payload: { room_id: number; user_id: number; user: { id: number; name: string; avatar: string | null }; role: string }) => {
    log.debug('room.member_joined', payload)
    membershipStore.onMemberJoined({ room_id: payload.room_id, member: { user_id: payload.user_id, user: payload.user, role: payload.role } as any })
    useToast().add({
      title: 'New Member',
      description: `${payload.user.name} joined the room`,
      color: 'success',
    })
  })

  socket.on('room.member_left', (payload: { room_id: number; user_id: number }) => {
    log.debug('room.member_left', payload)
    membershipStore.onMemberLeft(payload)
  })

  socket.on('room.member_kicked', (payload: { room_id: number; user_id: number; kicked_by: number }) => {
    log.debug('room.member_kicked', payload)
    membershipStore.onMemberKicked(payload)
    // If current user was kicked
    if (authStore.user?.id === payload.user_id) {
      useToast().add({
        title: 'Removed from Room',
        description: 'You were removed from the room',
        color: 'warning',
      })
    }
  })

  socket.on('room.member_blocked', (payload: { room_id: number; user_id: number; duration: string; banned_until?: string }) => {
    log.debug('room.member_blocked', payload)
    membershipStore.onMemberBlocked(payload)
    // If current user was blocked
    if (authStore.user?.id === payload.user_id) {
      const msg = payload.duration === 'permanent' ? 'You were banned from the room' : `You were banned for ${payload.duration}`
      useToast().add({
        title: 'Banned from Room',
        description: msg,
        color: 'error',
      })
    }
  })

  socket.on('room.member_role_changed', (payload: { room_id: number; user_id: number; previous_role: string; new_role: string }) => {
    log.debug('room.member_role_changed', payload)
    membershipStore.onMemberRoleChanged(payload)
    // If current user's role changed
    if (authStore.user?.id === payload.user_id) {
      const action = payload.new_role === 'admin' ? 'promoted to admin' : 'changed to member'
      useToast().add({
        title: 'Role Updated',
        description: `You have been ${action}`,
        color: 'info',
      })
    }
  })

  socket.on('room.join_request_created', (payload: { request_id: number; room_id: number; user: { id: number; name: string; avatar: string | null }; message: string | null }) => {
    log.debug('room.join_request_created', payload)
    useToast().add({
      title: 'Join Request',
      description: `${payload.user.name} wants to join your room`,
      color: 'info',
    })
    // Add to owner's pending requests list if viewing this room
    if (roomStore.currentRoom?.id === payload.room_id) {
      const newRequest: any = {
        id: payload.request_id,
        room_id: payload.room_id,
        user_id: payload.user.id,
        user: payload.user,
        message: payload.message,
        status: 'pending',
        created_at: new Date().toISOString(),
      }
      // Add to front of list if not already present
      if (!membershipStore.joinRequests.items.some(r => r.id === payload.request_id)) {
        membershipStore.joinRequests.items.unshift(newRequest)
      }
    }
  })

  socket.on('room.join_request_approved', (payload: { room_id: number; room_name: string }) => {
    log.debug('room.join_request_approved', payload)
    useToast().add({
      title: 'Request Approved!',
      description: `Welcome to ${payload.room_name}!`,
      color: 'success',
    })
    // Update store state via store method for proper reactivity
    membershipStore.onJoinRequestApproved(
      {
        room_id: payload.room_id,
        user_id: authStore.user?.id ?? 0,
      },
      roomStore.currentRoom?.id
    )
  })

  socket.on('room.join_request_rejected', (payload: { room_id: number; room_name: string }) => {
    log.debug('room.join_request_rejected', payload)
    useToast().add({
      title: 'Request Declined',
      description: `Your request to join ${payload.room_name} was declined`,
      color: 'warning',
    })
    // Update store state via store method for proper reactivity
    membershipStore.onJoinRequestRejected({ room_id: payload.room_id })
  })
}
