// ========================================
// Realtime Events Composable
// ========================================

import type { Socket } from 'socket.io-client'
import { useAllEventHandlers } from '~/events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RealtimeEvents]')

// Track if handlers are already registered
let handlersRegistered = false

/**
 * Register all realtime event handlers on a socket.
 * This is a composable that captures domain-specific registration functions
 * during the setup phase and returns a safe registration function.
 */
export function useRealtimeEvents() {
  const registerAll = useAllEventHandlers()

  function registerRealtimeEventHandlers(socket: Socket): void {
    if (handlersRegistered) {
      log.debug('Event handlers already registered, skipping')
      return
    }

    registerAll(socket)

    handlersRegistered = true
    log.debug('All realtime event handlers registered')
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
  handlersRegistered = false
}
