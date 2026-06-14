// ========================================
// Slide Overlay Events (REACT)
// ========================================
// socket.on('slide:play') → store mutation. Registered globally via the event
// registry (bound on socket connect in useAudioSocket), NOT in
// useRoomEventHandlers — so app-scope slides reach users who are in no room.

import type { Socket } from 'socket.io-client'
import type { SlidePlayPayload } from '~/types/slide'
import * as giftAssetCache from '~/services/giftAssetCache'
import { getSlideQueue } from '~/services/slideQueue'
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

      // EXECUTE — admit into the overlap engine (collision-band bucketing,
      // priority, coalesce) and mirror its playing set into the store.
      // recipientId is not on the S1 wire payload yet (resolver supplies it in a
      // later slice), so coalesce is currently sender-scoped and may merge
      // distinct recipients within the window. See ADR 0009.
      const playing = getSlideQueue().enqueue(
        { ...payload, senderId: payload.link?.userId ?? null, recipientId: null },
        Date.now(),
      )
      slideStore.setPlaying(playing)

      // REACT — lazily preload the asset (fire-and-forget); the player also
      // loads on demand, this just warms the cache.
      giftAssetCache
        .preloadSvga(payload.svgaUrl, $svga as giftAssetCache.SvgaPlugin)
        .catch(() => {})
    })
  }
}
