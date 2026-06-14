/**
 * Slide Overlay Store
 *
 * Ephemeral container for the triggered slide overlays currently on screen.
 * State + setter only — no socket, no API, no business logic. The collision-band
 * `SlideQueue` (priority, TTL, concurrency caps, coalescing) is the source of
 * truth for *what plays*; this store is a pure reactive projection of its
 * `playing` snapshot. Wiring lives in `events/slide.events.ts` (enqueue) and
 * `composables/slide/useSlideOverlay.ts` (tick + completion). See ADR 0009.
 */
import { defineStore } from 'pinia'
import type { ActiveSlide } from '~/types/slide'

export const useSlideOverlayStore = defineStore('slideOverlay', () => {
  const activeSlides = ref<ActiveSlide[]>([])

  /** Mirror the SlideQueue's playing snapshot. Stable `instanceId`s avoid SVGA remounts. */
  function setPlaying(slides: readonly ActiveSlide[]): void {
    activeSlides.value = slides.slice()
  }

  function reset(): void {
    activeSlides.value = []
  }

  return { activeSlides, setPlaying, reset }
})
