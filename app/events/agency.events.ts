// ========================================
// Agency Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  AgencyInvitationPayload,
  AgencyJoinRequestPayload,
  AgencyStatusPayload,
  AgencyMemberLeftPayload,
  AgencyLeaveRequestPayload,
} from '~/types/room/socket-events'


/**
 * Composable to register agency-related socket event handlers.
 * Captures toast dependencies during setup() phase.
 */
export function useAgencyEvents() {
  const toast = useToast()
  const store = useAgencyStore()

  return function registerAgencyEvents(socket: Socket): void {
    socket.on('agency.invitation', (payload: AgencyInvitationPayload) => {
      toast.add({
        title: 'Agency Invitation',
        description: `${payload.invited_by.name} invited you to ${payload.agency.name}`,
        color: 'info',
      })
    })

    socket.on('agency.join_request', (payload: AgencyJoinRequestPayload) => {
      toast.add({
        title: 'Join Request',
        description: `${payload.user.name} wants to join your agency`,
        color: 'info',
      })
    })

    socket.on('agency.join_request_approved', (payload: AgencyStatusPayload) => {
      toast.add({
        title: 'Request Approved!',
        description: `Welcome to ${payload.agency_name}!`,
        color: 'success',
      })
    })

    socket.on('agency.join_request_rejected', (payload: AgencyStatusPayload) => {
      toast.add({
        title: 'Request Declined',
        description: `Your request to ${payload.agency_name} was declined`,
        color: 'warning',
      })
    })

    socket.on('agency.member_kicked', (payload: AgencyStatusPayload) => {
      toast.add({
        title: 'Removed from Agency',
        description: `You were removed from ${payload.agency_name}`,
        color: 'warning',
      })
    })

    socket.on('agency.dissolved', (payload: AgencyStatusPayload) => {
      toast.add({
        title: 'Agency Dissolved',
        description: `${payload.agency_name} has been dissolved`,
        color: 'info',
      })
    })

    socket.on('agency.member_joined', () => {
      toast.add({
        title: 'New Member Joined',
        description: 'A new member has joined your agency!',
        color: 'success',
      })
    })

    socket.on('agency.member_left', (payload: AgencyMemberLeftPayload) => {
      toast.add({
        title: 'Member Left',
        description: `A member has left your agency (${payload.reason})`,
        color: 'info',
      })
    })

    // Owner side: a member requested to leave. This handler is toast-only —
    // the owner's leave-requests list (app/pages/agency/leave-requests.vue)
    // is refreshed by visiting the page / nav badge, not by this socket event.
    socket.on('agency.leave_request', (payload: AgencyLeaveRequestPayload) => {
      toast.add({
        title: 'Leave Request',
        description: `${payload.user.name} requested to leave your agency`,
        color: 'info',
      })
    })

    // Member side: the owner approved the leave request — membership has
    // actually ended now, mirror that in the store so the button/section
    // updates without waiting for a page reload.
    socket.on('agency.leave_request_approved', (payload: AgencyStatusPayload) => {
      store.userAgency.agency = null
      store.userAgency.membership = null
      store.userAgency.isOwner = false
      store.myLeaveRequest.item = null

      toast.add({
        title: 'Leave Approved',
        description: `You have left ${payload.agency_name}`,
        color: 'success',
      })
    })

    // Member side: the owner rejected the leave request — membership stays
    // active, but a cooldown now applies before another request can be made.
    // cooldown_ends_at isn't in the socket payload, so refetch the
    // membership to get the exact server-computed value.
    socket.on('agency.leave_request_rejected', (payload: AgencyStatusPayload) => {
      store.myLeaveRequest.item = null

      const { fetchUserAgency } = useAgencyMembership()
      void fetchUserAgency()

      toast.add({
        title: 'Leave Request Declined',
        description: `Your request to leave ${payload.agency_name} was declined`,
        color: 'warning',
      })
    })
  }
}
