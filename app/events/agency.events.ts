// ========================================
// Agency Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  AgencyInvitationPayload,
  AgencyJoinRequestPayload,
  AgencyStatusPayload,
  AgencyMemberJoinedPayload,
  AgencyMemberLeftPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[AgencyEvents]')

/**
 * Register agency-related socket event handlers.
 * Handles invitations, join requests, member changes, and dissolution.
 */
export function registerAgencyEvents(socket: Socket): void {
  socket.on('agency.invitation', (payload: AgencyInvitationPayload) => {
    log.debug('agency.invitation', payload)
    useToast().add({
      title: 'Agency Invitation',
      description: `${payload.invited_by.name} invited you to ${payload.agency.name}`,
      color: 'info',
    })
  })

  socket.on('agency.join_request', (payload: AgencyJoinRequestPayload) => {
    log.debug('agency.join_request', payload)
    useToast().add({
      title: 'Join Request',
      description: `${payload.user.name} wants to join your agency`,
      color: 'info',
    })
  })

  socket.on('agency.join_request_approved', (payload: AgencyStatusPayload) => {
    log.debug('agency.join_request_approved', payload)
    useToast().add({
      title: 'Request Approved!',
      description: `Welcome to ${payload.agency_name}!`,
      color: 'success',
    })
  })

  socket.on('agency.join_request_rejected', (payload: AgencyStatusPayload) => {
    log.debug('agency.join_request_rejected', payload)
    useToast().add({
      title: 'Request Declined',
      description: `Your request to ${payload.agency_name} was declined`,
      color: 'warning',
    })
  })

  socket.on('agency.member_kicked', (payload: AgencyStatusPayload) => {
    log.debug('agency.member_kicked', payload)
    useToast().add({
      title: 'Removed from Agency',
      description: `You were removed from ${payload.agency_name}`,
      color: 'warning',
    })
  })

  socket.on('agency.dissolved', (payload: AgencyStatusPayload) => {
    log.debug('agency.dissolved', payload)
    useToast().add({
      title: 'Agency Dissolved',
      description: `${payload.agency_name} has been dissolved`,
      color: 'info',
    })
  })

  socket.on('agency.member_joined', (payload: AgencyMemberJoinedPayload) => {
    log.debug('agency.member_joined', payload)
    useToast().add({
      title: 'New Member Joined',
      description: 'A new member has joined your agency!',
      color: 'success',
    })
  })

  socket.on('agency.member_left', (payload: AgencyMemberLeftPayload) => {
    log.debug('agency.member_left', payload)
    useToast().add({
      title: 'Member Left',
      description: `A member has left your agency (${payload.reason})`,
      color: 'info',
    })
  })
}
