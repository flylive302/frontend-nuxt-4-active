/**
 * Gift Playback Composable
 *
 * Single source of truth for gift playback orchestration.
 * Drives the FIFO queue: each item plays to completion (its player is keyed by
 * playback id, so advancing remounts a fresh animation), then `handleComplete`
 * pulls the next. Nothing restarts or interrupts the item on screen — sends and
 * combos only ever append to the queue (see useGiftSending).
 */
import { GIFT_PLAYBACK_TIMEOUT_MS } from '~/constants/gift'

// ========================================
// Composable
// ========================================

export function useGiftPlayback() {
  const giftStore = useGiftStore()
  const authStore = useAuthStore()

  // ========================================
  // State
  // ========================================

  const currentPlayback = computed(() => giftStore.currentPlayback)
  const isPlaying = computed(() => giftStore.isPlaying)
  const comboCount = computed(() => giftStore.comboCount)
  const isSender = computed(() => authStore.user?.id === currentPlayback.value?.senderId)

  const isMinimized = ref(false)

  // ========================================
  // Playback Timeout (Safety Net)
  // ========================================

  let playbackTimeoutId: ReturnType<typeof setTimeout> | null = null

  /** Timestamp of the last timeout (re-)arm — throttles heartbeat re-arms */
  let lastArmedAt = 0

  /** Minimum gap between heartbeat re-arms — players emit progress up to ~30×/s */
  const REARM_THROTTLE_MS = 1000

  /** Clear the playback timeout */
  function clearPlaybackTimeout(): void {
    if (playbackTimeoutId) {
      clearTimeout(playbackTimeoutId)
      playbackTimeoutId = null
    }
  }

  /** Start the stall timeout — force completes if playback stops making progress */
  function startPlaybackTimeout(): void {
    clearPlaybackTimeout()
    lastArmedAt = Date.now()
    playbackTimeoutId = setTimeout(() => {
      handleComplete()
    }, GIFT_PLAYBACK_TIMEOUT_MS)
  }

  /**
   * Playback heartbeat — players emit `progress` while frames advance.
   * Re-arms the stall timeout so a healthy animation of any duration is
   * never cut off; the timer only fires after GIFT_PLAYBACK_TIMEOUT_MS
   * of genuine silence (never started, or froze mid-play).
   */
  function handleProgress(): void {
    if (!playbackTimeoutId) return
    if (Date.now() - lastArmedAt < REARM_THROTTLE_MS) return
    startPlaybackTimeout()
  }

  // ========================================
  // Core Methods
  // ========================================

  /** Handle playback completion — advances to the next item in the queue */
  function handleComplete(): void {
    clearPlaybackTimeout()
    giftStore.onPlaybackComplete()
  }

  // ========================================
  // Minimize Toggle
  // ========================================

  function toggleMinimize(): void {
    isMinimized.value = !isMinimized.value
  }

  // ========================================
  // Watchers
  // ========================================

  // Arm the stall timeout for each item as it starts; clear when nothing plays.
  // The id watch re-arms on every queue advance (not just play↔stop) so a fresh
  // timeout guards each item, not only the first.
  watch(
    () => currentPlayback.value?.id,
    (id) => {
      if (id) {
        startPlaybackTimeout()
      }
      else {
        clearPlaybackTimeout()
        isMinimized.value = false
      }
    },
  )

  // Cleanup timeout on scope disposal
  onScopeDispose(clearPlaybackTimeout)

  // ========================================
  // Return
  // ========================================

  return {
    // State
    currentPlayback,
    isPlaying,
    comboCount,
    isSender,
    isMinimized,

    // Methods
    handleComplete,
    handleProgress,
    toggleMinimize,
    clearPlaybackTimeout,
  }
}
