/**
 * Slide Overlay Store
 *
 * Ephemeral container for the triggered slide overlays currently on screen.
 * State + setters only — no socket, no API, no business logic (those live in
 * `events/slide.events.ts` and `composables/slide/useSlideOverlay.ts`).
 *
 * Slice 1 is a trivial render-as-arrives list; the real collision-band
 * `SlideQueue` (priority, TTL, concurrency caps) lands in slice 2.
 */
import { defineStore } from 'pinia'
import type { ActiveSlide, SlidePlayPayload } from '~/types/slide'

export const useSlideOverlayStore = defineStore('slideOverlay', () => {
  const activeSlides = ref<ActiveSlide[]>([])

  function addSlide(payload: SlidePlayPayload): void {
    activeSlides.value.push({
      ...payload,
      instanceId: `slide-${payload.slideId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })
  }

  function removeSlide(instanceId: string): void {
    const i = activeSlides.value.findIndex((s) => s.instanceId === instanceId)
    if (i !== -1) activeSlides.value.splice(i, 1)
  }

  function reset(): void {
    activeSlides.value = []
  }

  return { activeSlides, addSlide, removeSlide, reset }
})
