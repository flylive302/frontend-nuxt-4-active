// ========================================
// Realtime Events Composable
// ========================================

import type { Socket } from 'socket.io-client'
import { registerAllEventHandlers } from '~/events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RealtimeEvents]')

// Track if handlers are already registered
let handlersRegistered = false

/**
 * Register all realtime event handlers on a socket.
 * Called once when socket connects.
 *
 * Delegates to the domain event registry which distributes
 * handlers across domain-scoped files for maintainability.
 */
export function registerRealtimeEventHandlers(socket: Socket): void {
  if (handlersRegistered) {
    log.debug('Event handlers already registered, skipping')
    return
  }

  registerAllEventHandlers(socket)

  handlersRegistered = true
  log.debug('All realtime event handlers registered')
}

/**
 * Reset handler registration state (call on disconnect).
 */
export function resetRealtimeHandlers(): void {
  handlersRegistered = false
}
