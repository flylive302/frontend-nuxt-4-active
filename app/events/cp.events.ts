// ========================================
// CP Events (CP event)
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  CpPairBoundPayload,
  CpPairUpdatedPayload,
  CpPairBrokenPayload,
  CpWeekClosedPayload,
} from '~/types/room/socket-events'

/**
 * Composable to register CP-event socket handlers.
 * REACT only: payloads are hints, so handlers just bump the CP store's signal
 * counters — no business logic, no API calls. Composables (`useCpEventData`,
 * `useCpProfile`, `useCpSeatHearts`) watch the counters and refetch (debounced).
 */
export function useCpEvents() {
  const store = useCpStore()

  return function registerCpEvents(socket: Socket): void {
    socket.on('cp.pair.bound', (_payload: CpPairBoundPayload) => {
      store.bumpPairSignal(true)
    })

    socket.on('cp.pair.updated', (_payload: CpPairUpdatedPayload) => {
      store.bumpPairSignal(false)
    })

    socket.on('cp.pair.broken', (_payload: CpPairBrokenPayload) => {
      store.bumpPairSignal(true)
    })

    socket.on('cp.week.closed', (_payload: CpWeekClosedPayload) => {
      store.bumpWeekClosedSignal()
    })
  }
}
