// ========================================
// Slide Overlay Events (REACT)
// ========================================
// socket.on('slide:play') → store mutation. Registered globally via the event
// registry (bound on socket connect in useAudioSocket), NOT in
// useRoomEventHandlers — so app-scope slides reach users who are in no room.

import type { Socket } from 'socket.io-client'
import type { SlidePlayPayload } from '~/types/slide'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SlideEvents]')

/**
 * Composable to register the slide overlay socket handler. Captures the shared
 * playback admission path during setup() so it can be used safely inside the
 * socket callback. Entry banners join the same engine via the room join paths.
 */
export function useSlideEvents() {
  const { admitPayload } = useSlidePlayback()

  return function registerSlideEvents(socket: Socket): void {
    socket.on('slide:play', (payload: SlidePlayPayload) => {
      // GATE — ignore malformed payloads.
      if (!payload?.svgaUrl) {
        log.warn('Ignoring slide:play with no svgaUrl')
        return
      }

      // EXECUTE + REACT — admit into the one overlap engine (collision-band
      // bucketing, priority, coalesce) and warm the asset cache. recipientId is
      // not on the wire payload yet (resolver supplies it in a later slice), so
      // coalesce is currently sender-scoped. See ADR 0009.
      admitPayload(payload)
    })
  }
}
