import type { EntrySlideConfig, EntrySlideContext, SlidePlayPayload } from '~/types/slide'
import type { SlideEnqueueInput } from '~/utils/slide-queue'
import * as giftAssetCache from '~/services/giftAssetCache'
import { getSlideQueue } from '~/services/slideQueue'
import { resolveEntrySlide } from '~/utils/slide-entry-resolver'

/**
 * Lean shared admission path into the one slide engine (EXECUTE + REACT).
 *
 * Both the global `slide:play` socket reactor (gift/lucky, server-resolved) and
 * the room-entry join paths (entry, client-resolved) funnel through here so the
 * collision-band `SlideQueue` is the single source of truth — no second engine,
 * no duplicated enqueue logic. Unlike `useSlideOverlay`, this composable owns no
 * timers or modal state, so it is safe to instantiate inside the room socket
 * reactors without spinning up a second TTL tick loop (ADR 0009).
 */
export function useSlidePlayback() {
  const slideStore = useSlideOverlayStore()
  const { $svga } = useNuxtApp()
  const queue = getSlideQueue()

  /** EXECUTE — admit a resolved slide into the engine + mirror the playing set. */
  function admit(input: SlideEnqueueInput): void {
    slideStore.setPlaying(queue.enqueue(input, Date.now()))

    // REACT — warm the asset cache (the player also loads on demand).
    giftAssetCache
      .preloadSvga(input.svgaUrl, $svga as giftAssetCache.SvgaPlugin)
      .catch(() => {})
  }

  /** EXECUTE — admit a server-resolved `slide:play` payload (gift/lucky). */
  function admitPayload(payload: SlidePlayPayload): void {
    admit({ ...payload, senderId: payload.link?.userId ?? null, recipientId: null })
  }

  /**
   * EXECUTE — resolve a joining user's equipped entry Slide locally and admit it.
   * No-op when the prop carries no bound slide config.
   */
  function playEntrySlide(config: EntrySlideConfig | null | undefined, context: EntrySlideContext): void {
    const payload = resolveEntrySlide(config, context)
    if (!payload) return
    admit({ ...payload, senderId: context.userId, recipientId: null })
  }

  /** REACT — drop room-scope slides on room leave; app-scope banners persist. */
  function clearRoomScoped(): void {
    slideStore.setPlaying(queue.clearScope('room', Date.now()))
  }

  return { admit, admitPayload, playEntrySlide, clearRoomScoped }
}
