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

  /** Clear the playback timeout */
  function clearPlaybackTimeout(): void {
    if (playbackTimeoutId) {
      clearTimeout(playbackTimeoutId)
      playbackTimeoutId = null
    }
  }

  /** Start the playback timeout — force completes if an animation stalls */
  function startPlaybackTimeout(): void {
    clearPlaybackTimeout()
    playbackTimeoutId = setTimeout(() => {
      handleComplete()
    }, GIFT_PLAYBACK_TIMEOUT_MS)
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
    toggleMinimize,
    clearPlaybackTimeout,
  }
}
