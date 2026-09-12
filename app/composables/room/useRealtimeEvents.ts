// ========================================
// Realtime Events Composable
// ========================================

import type { Socket } from 'socket.io-client'
import { useAllEventHandlers } from '~/events'


// The socket instance the global handlers are registered on. Keyed to the
// instance, not a boolean, so a brand-new socket can never be skipped by a
// stale flag — a transport-level reconnect reuses the same instance (its
// listeners survive), a rebuilt socket is a different object and registers
// fresh regardless of whether `resetRealtimeHandlers` ran
// (room-page-runtime-audit 09).
let registeredSocket: Socket | null = null

/**
 * Register all realtime event handlers on a socket.
 * This is a composable that captures domain-specific registration functions
 * during the setup phase and returns a safe registration function.
 */
export function useRealtimeEvents() {
  const registerAll = useAllEventHandlers()

  function registerRealtimeEventHandlers(socket: Socket): void {
    if (registeredSocket === socket) {
      return
    }

    registerAll(socket)

    registeredSocket = socket
  }

  return {
    registerRealtimeEventHandlers,
    resetRealtimeHandlers,
  }
}

/**
 * Reset handler registration state (call on disconnect).
 */
export function resetRealtimeHandlers(): void {
  registeredSocket = null
}
