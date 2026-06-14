import type { ActiveSlide } from '~/types/slide'
import { SLIDE_QUEUE_TICK_INTERVAL_MS } from '~/constants/room'
import { getSlideQueue } from '~/services/slideQueue'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useSlideOverlay]')

/**
 * Consumer-facing orchestrator for the global slide overlay layer (GATE →
 * EXECUTE → REACT). The `slide:play` subscription itself lives in
 * `events/slide.events.ts` (the globally-registered REACT registry, which
 * enqueues into the shared SlideQueue); this composable owns the TTL tick
 * cadence and completion advancement of that queue, plus the click-to-track
 * action, and surfaces the room-entry password prompt for the layer to render.
 *
 * The collision-band `SlideQueue` is the source of truth for what plays; the
 * store mirrors its `playing` snapshot for rendering. See ADR 0009.
 */
export function useSlideOverlay() {
  const slideStore = useSlideOverlayStore()
  const { activeSlides } = storeToRefs(slideStore)
  const queue = getSlideQueue()

  // Own useRoomEntry() instance so its password-prompt state is co-located with
  // the overlay layer that renders the modal.
  const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
  const { trackUserById } = useTrackUser(enterRoom)

  // Track-confirm prompt state, co-located with the layer that renders the
  // dialog. A tap on a `track` slide opens this; navigation only runs on confirm.
  const showTrackConfirm = ref(false)
  const pendingTrackUserId = ref<number | null>(null)

  // Tick the queue so stale waiters expire even when no completion drives it.
  // Expiry never frees a band, so the playing set (and store) is left untouched.
  let tickTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    if (!import.meta.client) return
    tickTimer = setInterval(() => queue.tick(Date.now()), SLIDE_QUEUE_TICK_INTERVAL_MS)
  })
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer)
  })

  /** REACT — release the band on SVGA completion and mirror the advanced queue. */
  function onComplete(instanceId: string): void {
    slideStore.setPlaying(queue.onComplete(instanceId, Date.now()))
  }

  /** INTENT/EXECUTE — handle a tap on a clickable slide. */
  async function handleSlideClick(slide: ActiveSlide): Promise<void> {
    const { type, userId } = slide.link

    // GATE — non-interactive or missing target.
    if (type === 'none' || userId == null) return

    if (type === 'track') {
      // GATE — defer navigation behind an explicit confirmation prompt.
      pendingTrackUserId.value = userId
      showTrackConfirm.value = true
      return
    }

    // 'profile' links resolve by user signature, which the slide payload does
    // not carry; deferred until a later slice supplies it. Track is the S1 path.
    log.debug('Unsupported slide link type for now', type)
  }

  /** EXECUTE — user confirmed; track into the sender's room. */
  async function confirmTrack(): Promise<void> {
    const userId = pendingTrackUserId.value
    showTrackConfirm.value = false
    pendingTrackUserId.value = null
    if (userId == null) return
    await trackUserById(userId)
  }

  /** INTENT — user dismissed the prompt; drop the pending target. */
  function cancelTrack(): void {
    showTrackConfirm.value = false
    pendingTrackUserId.value = null
  }

  return {
    activeSlides,
    onComplete,
    handleSlideClick,
    showTrackConfirm,
    confirmTrack,
    cancelTrack,
    showPasswordPrompt,
    pendingRoom,
    onPasswordSuccess,
  }
}
