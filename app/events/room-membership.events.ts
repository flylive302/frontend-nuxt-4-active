// ========================================
// Room Membership Events (REACT layer)
// ========================================
// Maps incoming socket events to small, typed setter calls on the
// roomMembership store. All conditional / routing logic lives here so the
// store stays state-only.

import type { Socket } from 'socket.io-client'
import type { RoomMember, RoomJoinRequest, RoomInvitation } from '~/types/room/room'


interface MinimalUser {
  id: number
  name: string
  avatar: string | null
}

/**
 * Composable to register room membership socket event handlers.
 * Captures store and toast dependencies during setup() phase.
 */
export function useRoomMembershipEvents() {
  const authStore = useAuthStore()
  const roomStore = useRoomStore()
  const membershipStore = useRoomMembershipStore()
  const toast = useToast()

  return function registerRoomMembershipEvents(socket: Socket): void {
    // ── member.joined ─────────────────────────────────────────────
    socket.on('room.member_joined', (payload: {
      room_id: number
      user_id: number
      user: MinimalUser
      role: string
    }) => {
      if (membershipStore.isCurrentRoom(payload.room_id)) {
        const member = {
          user_id: payload.user_id,
          user: payload.user,
          role: payload.role,
        } as unknown as RoomMember
        membershipStore.addMember(member)
      }
      toast.add({
        title: 'New Member',
        description: `${payload.user.name} joined the room`,
        color: 'success',
      })
    })

    // ── member.left ───────────────────────────────────────────────
    socket.on('room.member_left', (payload: { room_id: number; user_id: number }) => {
      if (membershipStore.isCurrentRoom(payload.room_id)) {
        membershipStore.removeMember(payload.user_id)
      }
    })

    // ── member.removed (kick + ban, unified) ──────────────────────
    socket.on('room.member_removed', (payload: {
      room_id: number
      user_id: number
      removed_by: number
      duration: string
      banned_until?: string
    }) => {
      if (membershipStore.isCurrentRoom(payload.room_id)) {
        membershipStore.removeMember(payload.user_id)
      }
      if (authStore.user?.id === payload.user_id) {
        const msg = payload.duration === 'permanent'
          ? 'You were banned from the room'
          : `You were removed from the room for ${payload.duration}`
        toast.add({ title: 'Removed from Room', description: msg, color: 'error' })
      }
    })

    // ── member.role_changed ───────────────────────────────────────
    // Backend emits to both room and user directly, so the promoted user
    // gets it twice. Dedupe in the REACT layer.
    let lastRoleChangeKey = ''
    socket.on('room.member_role_changed', (payload: {
      room_id: number
      user_id: number
      previous_role: string
      new_role: string
    }) => {
      if (membershipStore.isCurrentRoom(payload.room_id)) {
        membershipStore.updateMemberRole(payload.user_id, payload.new_role as RoomMember['role'])
      }

      if (authStore.user?.id === payload.user_id) {
        // Patch own membership when the event targets the room being viewed.
        // Gate on roomStore.currentRoom (set at join time), NOT
        // membershipStore.isCurrentRoom — that is only set once the members
        // panel has fetched — and myMembership may never have been fetched at
        // all, so neither can be relied on for the viewer's own permission
        // derivation (canEdit et al.). The event arrives on the user's
        // personal channel for ANY room they belong to; without the room
        // match, a promotion elsewhere would clobber the viewed room's state.
        if (roomStore.currentRoom?.id === payload.room_id) {
          const mine = membershipStore.myMembership
          if (mine && mine.room_id === payload.room_id) {
            membershipStore.setMyMembership({ ...mine, role: payload.new_role as RoomMember['role'] })
          } else {
            membershipStore.setMyMembership({
              id: 0,
              room_id: payload.room_id,
              user_id: payload.user_id,
              role: payload.new_role,
              status: 'active',
              created_at: new Date().toISOString(),
              joined_at: new Date().toISOString(),
              user: null,
            } as unknown as RoomMember)
          }
        }

        const dedupeKey = `${payload.room_id}:${payload.user_id}:${payload.new_role}`
        if (dedupeKey === lastRoleChangeKey) return
        lastRoleChangeKey = dedupeKey
        setTimeout(() => { lastRoleChangeKey = '' }, 2000)

        const action = payload.new_role === 'admin' ? 'promoted to admin' : 'changed to member'
        toast.add({ title: 'Role Updated', description: `You have been ${action}`, color: 'info' })
      }
    })

    // ── join_request_created (owner-side notification) ────────────
    socket.on('room.join_request_created', (payload: {
      request_id: number
      room_id: number
      user: MinimalUser
      message: string | null
    }) => {
      toast.add({
        title: 'Join Request',
        description: `${payload.user.name} wants to join your room`,
        color: 'info',
      })
      if (roomStore.currentRoom?.id === payload.room_id) {
        const request = {
          id: payload.request_id,
          room_id: payload.room_id,
          user_id: payload.user.id,
          user: payload.user,
          message: payload.message,
          status: 'pending',
          created_at: new Date().toISOString(),
        } as unknown as RoomJoinRequest
        membershipStore.addOwnerJoinRequest(request)
      }
    })

    // ── invitation_created ────────────────────────────────────────
    socket.on('room.invitation_created', (payload: {
      room_id: number
      room_name: string
      invitation_id: number
      inviter_name: string
      message: string | null
    }) => {
      toast.add({
        title: 'Room Invitation',
        description: `${payload.inviter_name} invited you to join ${payload.room_name}`,
        color: 'info',
      })
      const invitation = {
        id: payload.invitation_id,
        room_id: payload.room_id,
        room: { id: payload.room_id, name: payload.room_name },
        status: 'pending',
        message: payload.message,
        created_at: new Date().toISOString(),
      } as unknown as RoomInvitation
      membershipStore.addReceivedInvitation(invitation)
    })

    // ── join_request_approved ─────────────────────────────────────
    socket.on('room.join_request_approved', (payload: { room_id: number; room_name: string }) => {
      toast.add({
        title: 'Request Approved!',
        description: `Welcome to ${payload.room_name}!`,
        color: 'success',
      })
      membershipStore.clearMyJoinRequest(payload.room_id)
      if (membershipStore.isCurrentRoom(payload.room_id) && authStore.user) {
        const member = {
          id: 0,
          room_id: payload.room_id,
          user_id: authStore.user.id,
          role: 'member',
          status: 'active',
          created_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          user: null,
        } as unknown as RoomMember
        membershipStore.setMyMembership(member)
      }
    })

    // ── join_request_rejected ─────────────────────────────────────
    socket.on('room.join_request_rejected', (payload: { room_id: number; room_name: string }) => {
      toast.add({
        title: 'Request Declined',
        description: `Your request to join ${payload.room_name} was declined`,
        color: 'warning',
      })
      membershipStore.clearMyJoinRequest(payload.room_id)
    })

    // ── join_request_cancelled ────────────────────────────────────
    socket.on('room.join_request_cancelled', (payload: {
      room_id: number
      request_id: number
      user_id: number
    }) => {
      if (membershipStore.isCurrentRoom(payload.room_id)) {
        membershipStore.removeOwnerJoinRequest(payload.request_id)
        toast.add({
          title: 'Request Cancelled',
          description: 'A user cancelled their join request',
          color: 'neutral',
        })
      }
    })

    // ── invitation_cancelled ──────────────────────────────────────
    socket.on('room.invitation_cancelled', (payload: {
      room_id: number
      room_name: string
      invitation_id: number
    }) => {
      membershipStore.removeReceivedInvitation(payload.invitation_id)
      toast.add({
        title: 'Invitation Withdrawn',
        description: `Your invitation to ${payload.room_name} was withdrawn`,
        color: 'warning',
      })
    })

    // ── invitation_declined (inviter-side notification) ────────────
    socket.on('room.invitation_declined', (payload: {
      room_id: number
      room_name: string
      invitation_id: number
    }) => {
      membershipStore.removeSentInvitation(payload.invitation_id)
      toast.add({
        title: 'Invitation Declined',
        description: `Your invitation to join ${payload.room_name} was declined`,
        color: 'neutral',
      })
    })

    // ── user_unblocked ────────────────────────────────────────────
    socket.on('room.user_unblocked', (payload: { room_id: number; room_name: string }) => {
      toast.add({
        title: 'Unblocked',
        description: `You have been unblocked from ${payload.room_name}`,
        color: 'success',
      })
    })
  }
}
