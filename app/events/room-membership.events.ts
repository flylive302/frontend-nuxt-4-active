// ========================================
// Room Membership Events
// ========================================

import type { Socket } from 'socket.io-client'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomMembershipEvents]')

/**
 * Register room membership socket event handlers.
 * Handles member joins/leaves/removals, role changes, and join requests.
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

  /**
   * Unified member removed event — replaces old kicked + blocked events.
   * Covers instant removal, timed bans, and permanent bans.
   */
  socket.on('room.member_removed', (payload: {
    room_id: number
    user_id: number
    removed_by: number
    duration: string
    banned_until?: string
  }) => {
    log.debug('room.member_removed', payload)
    membershipStore.onMemberRemoved(payload)
    // If current user was removed
    if (authStore.user?.id === payload.user_id) {
      const msg = payload.duration === 'permanent'
        ? 'You were banned from the room'
        : `You were removed from the room for ${payload.duration}`
      useToast().add({
        title: 'Removed from Room',
        description: msg,
        color: 'error',
      })
    }
  })

  // Dedupe guard: backend emits role_changed to both room and user directly,
  // so the promoted user (who is in the room) receives it twice.
  let lastRoleChangeKey = ''

  socket.on('room.member_role_changed', (payload: { room_id: number; user_id: number; previous_role: string; new_role: string }) => {
    log.debug('room.member_role_changed', payload)
    membershipStore.onMemberRoleChanged(payload)

    // Show toast only for the current user, with deduplication
    if (authStore.user?.id === payload.user_id) {
      const dedupeKey = `${payload.user_id}:${payload.new_role}`
      if (dedupeKey === lastRoleChangeKey) return
      lastRoleChangeKey = dedupeKey
      // Reset after short window to allow future legitimate changes
      setTimeout(() => { lastRoleChangeKey = '' }, 2000)

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

  socket.on('room.invitation_created', (payload: { room_id: number; room_name: string; invitation_id: number; inviter_name: string; message: string | null }) => {
    log.debug('room.invitation_created', payload)
    useToast().add({
      title: 'Room Invitation',
      description: `${payload.inviter_name} invited you to join ${payload.room_name}`,
      color: 'info',
    })
    // Add to received invitations for immediate UI update
    const newInvitation: any = {
      id: payload.invitation_id,
      room_id: payload.room_id,
      room: { id: payload.room_id, name: payload.room_name },
      status: 'pending',
      message: payload.message,
      created_at: new Date().toISOString(),
    }
    if (!membershipStore.receivedInvitations.items.some(inv => inv.id === payload.invitation_id)) {
      membershipStore.receivedInvitations.items.unshift(newInvitation)
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

  socket.on('room.join_request_cancelled', (payload: { room_id: number; request_id: number; user_id: number }) => {
    log.debug('room.join_request_cancelled', payload)
    membershipStore.onJoinRequestCancelled(payload)
    if (roomStore.currentRoom?.id === payload.room_id) {
      useToast().add({
        title: 'Request Cancelled',
        description: 'A user cancelled their join request',
        color: 'neutral',
      })
    }
  })

  socket.on('room.invitation_cancelled', (payload: { room_id: number; room_name: string; invitation_id: number }) => {
    log.debug('room.invitation_cancelled', payload)
    membershipStore.onInvitationCancelled(payload)
    useToast().add({
      title: 'Invitation Withdrawn',
      description: `Your invitation to ${payload.room_name} was withdrawn`,
      color: 'warning',
    })
  })

  socket.on('room.user_unblocked', (payload: { room_id: number; room_name: string }) => {
    log.debug('room.user_unblocked', payload)
    useToast().add({
      title: 'Unblocked',
      description: `You have been unblocked from ${payload.room_name}`,
      color: 'success',
    })
  })
}
