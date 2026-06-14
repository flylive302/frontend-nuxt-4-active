/**
 * Shared SlideQueue instance (low-level infra).
 *
 * The overlap engine (`utils/slide-queue.ts`) is a pure, stateful model with one
 * lifecycle per app: the global `slide:play` subscription (`events/`) enqueues
 * into it, while the overlay composable ticks/advances it. Both reach the *same*
 * instance through this accessor — no store coupling, no Vue, no UI. Mirrors how
 * `giftAssetCache` is a shared stateful module the event layer delegates to.
 *
 * The mobile/desktop global cap is resolved from the viewport once, at first
 * use (browser-only); on the server it falls back to the mobile cap.
 */
import {
  SLIDE_QUEUE_COALESCE_WINDOW_MS,
  SLIDE_QUEUE_DESKTOP_MIN_WIDTH_PX,
  SLIDE_QUEUE_GLOBAL_CAP_DESKTOP,
  SLIDE_QUEUE_GLOBAL_CAP_MOBILE,
  SLIDE_QUEUE_PER_BAND_DEPTH,
  SLIDE_QUEUE_TTL_MS,
} from '~/constants/room'
import { SlideQueue } from '~/utils/slide-queue'

let instance: SlideQueue | null = null

/** Desktop viewports get a higher concurrent cap; everything else stays mobile-conservative. */
function resolveGlobalCap(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return SLIDE_QUEUE_GLOBAL_CAP_MOBILE
  }
  return window.matchMedia(`(min-width: ${SLIDE_QUEUE_DESKTOP_MIN_WIDTH_PX}px)`).matches
    ? SLIDE_QUEUE_GLOBAL_CAP_DESKTOP
    : SLIDE_QUEUE_GLOBAL_CAP_MOBILE
}

/** The app-wide SlideQueue, created lazily on first use. */
export function getSlideQueue(): SlideQueue {
  if (!instance) {
    instance = new SlideQueue({
      ttlMs: SLIDE_QUEUE_TTL_MS,
      perBandDepth: SLIDE_QUEUE_PER_BAND_DEPTH,
      globalCap: resolveGlobalCap(),
      coalesceWindowMs: SLIDE_QUEUE_COALESCE_WINDOW_MS,
    })
  }
  return instance
}
