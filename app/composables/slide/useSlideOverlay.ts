import type { ActiveSlide } from '~/types/slide'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useSlideOverlay]')

/**
 * Consumer-facing orchestrator for the global slide overlay layer (GATE →
 * EXECUTE → REACT). The `slide:play` subscription itself lives in
 * `events/slide.events.ts` (the globally-registered REACT registry); this
 * composable owns completion removal and the click-to-track action, and
 * surfaces the room-entry password prompt for the layer to render.
 *
 * Slice 1 renders slides as they arrive (trivial queue). The collision-band
 * SlideQueue (priority/TTL/concurrency) lands in slice 2.
 */
export function useSlideOverlay() {
  const slideStore = useSlideOverlayStore()
  const { activeSlides } = storeToRefs(slideStore)

  // Own useRoomEntry() instance so its password-prompt state is co-located with
  // the overlay layer that renders the modal.
  const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
  const { trackUserById } = useTrackUser(enterRoom)

  /** REACT — drop the slide once its SVGA finishes. */
  function onComplete(instanceId: string): void {
    slideStore.removeSlide(instanceId)
  }

  /** INTENT/EXECUTE — handle a tap on a clickable slide. */
  async function handleSlideClick(slide: ActiveSlide): Promise<void> {
    const { type, userId } = slide.link

    // GATE — non-interactive or missing target.
    if (type === 'none' || userId == null) return

    if (type === 'track') {
      await trackUserById(userId)
      return
    }

    // 'profile' links resolve by user signature, which the slide payload does
    // not carry; deferred until a later slice supplies it. Track is the S1 path.
    log.debug('Unsupported slide link type for now', type)
  }

  return {
    activeSlides,
    onComplete,
    handleSlideClick,
    showPasswordPrompt,
    pendingRoom,
    onPasswordSuccess,
  }
}
