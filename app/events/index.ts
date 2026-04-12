// ========================================
// Domain Event Registry
// ========================================

import type { Socket } from 'socket.io-client'
import { useEconomyEvents } from './economy.events'
import { useProgressionEvents } from './progression.events'
import { useRoomEvents } from './room.events'
import { useRoomMembershipEvents } from './room-membership.events'
import { useIncomeEvents } from './income.events'
import { useAgencyEvents } from './agency.events'
import { useSystemEvents } from './system.events'
import { useVipEvents } from './vip.events'
import { useFollowEvents } from './follow.events'

/**
 * Registry of all domain-specific socket event handlers.
 *
 * This is a composable that captures dependencies once (during setup)
 * and returns a function to bind those captured dependencies to a socket.
 *
 * This pattern ensures that inject()-based composables (like useToast, useRoomStore)
 * are called in the correct context while allowing the event handlers to be
 * registered safely inside Socket.IO callbacks.
 */
export function useAllEventHandlers() {
  const registerEconomy = useEconomyEvents()
  const registerProgression = useProgressionEvents()
  const registerRoom = useRoomEvents()
  const registerRoomMembership = useRoomMembershipEvents()
  const registerIncome = useIncomeEvents()
  const registerAgency = useAgencyEvents()
  const registerSystem = useSystemEvents()
  const registerVip = useVipEvents()
  const registerFollow = useFollowEvents()

  return function registerAllEventHandlers(socket: Socket): void {
    registerEconomy(socket)
    registerProgression(socket)
    registerRoom(socket)
    registerRoomMembership(socket)
    registerIncome(socket)
    registerAgency(socket)
    registerSystem(socket)
    registerVip(socket)
    registerFollow(socket)
  }
}
