// ========================================
// Presence Events (dm-realtime-platform/07)
// ========================================
// Handles the `presence.update` MSAB push event — REACT-only: store
// mutation, no business logic, no API calls. Delivery is already scoped
// server-side to subscribed sockets (presence:user:{id} rooms), so no
// filtering is needed here.

import type { Socket } from 'socket.io-client'

interface PresenceUpdatePayload {
  userId: number
  online: boolean
}

/**
 * Composable to register presence-related socket event handlers.
 * Captures store dependency during setup() phase.
 */
export function usePresenceEvents() {
  const store = usePresenceStore()

  return function registerPresenceEvents(socket: Socket): void {
    socket.on('presence.update', (payload: PresenceUpdatePayload) => {
      store.setOnline(payload.userId, payload.online)
    })
  }
}
