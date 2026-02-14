// ========================================
// Domain Event Registry
// ========================================

import type { Socket } from 'socket.io-client'
import { registerEconomyEvents } from './economy.events'
import { registerProgressionEvents } from './progression.events'
import { registerRoomEvents } from './room.events'
import { registerRoomMembershipEvents } from './room-membership.events'
import { registerIncomeEvents } from './income.events'
import { registerAgencyEvents } from './agency.events'
import { registerSystemEvents } from './system.events'

/**
 * Register all domain-specific socket event handlers.
 *
 * Each domain file exports a registration function that binds
 * socket events to store mutations. This replaces the monolithic
 * useRealtimeEvents composable with domain-scoped handlers.
 *
 * To add events for a new domain:
 * 1. Create `events/<domain>.events.ts`
 * 2. Export a `register<Domain>Events(socket)` function
 * 3. Call it here
 *
 * This keeps the registry open for extension, closed for modification (OCP).
 */
export function registerAllEventHandlers(socket: Socket): void {
  registerEconomyEvents(socket)
  registerProgressionEvents(socket)
  registerRoomEvents(socket)
  registerRoomMembershipEvents(socket)
  registerIncomeEvents(socket)
  registerAgencyEvents(socket)
  registerSystemEvents(socket)
}
