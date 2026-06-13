// ========================================
// Slide Overlay Events (REACT)
// ========================================
// socket.on('slide:play') → store mutation. Registered globally via the event
// registry (bound on socket connect in useAudioSocket), NOT in
// useRoomEventHandlers — so app-scope slides reach users who are in no room.

import type { Socket } from 'socket.io-client'
import type { SlidePlayPayload } from '~/types/slide'
import * as giftAssetCache from '~/services/giftAssetCache'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SlideEvents]')

/**
 * Composable to register the slide overlay socket handler. Captures the store
 * during setup() so it can be mutated safely inside the socket callback.
 */
export function useSlideEvents() {
  const slideStore = useSlideOverlayStore()
  const { $svga } = useNuxtApp()

  return function registerSlideEvents(socket: Socket): void {
    socket.on('slide:play', (payload: SlidePlayPayload) => {
      // GATE — ignore malformed payloads.
      if (!payload?.svgaUrl) {
        log.warn('Ignoring slide:play with no svgaUrl')
        return
      }

      // EXECUTE — promote to an active on-screen slide.
      slideStore.addSlide(payload)

      // REACT — lazily preload the asset (fire-and-forget); the player also
      // loads on demand, this just warms the cache.
      giftAssetCache
        .preloadSvga(payload.svgaUrl, $svga as giftAssetCache.SvgaPlugin)
        .catch(() => {})
    })
  }
}
