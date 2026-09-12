/**
 * Gift Playback Composable
 *
 * Single source of truth for gift playback orchestration.
 * Drives two lane kinds (gift-backlog-and-lag 06):
 *  - CENTER: today's FIFO — one item plays full-screen to completion (its
 *    player is keyed by playback id, so advancing remounts a fresh
 *    animation), then `handleComplete()` pulls the next.
 *  - SIDE: up to SIDE_LANES small players run concurrently; each lane index
 *    has its own stall timeout and completion handler.
 * Nothing restarts or interrupts an item on screen — sends and combos only
 * ever append to the queue (see useGiftSending).
 */
import { GIFT_PLAYBACK_TIMEOUT_MS, SIDE_LANES } from '~/constants/gift'

// ========================================
// Composable
// ========================================

export function useGiftPlayback() {
  const giftStore = useGiftStore()
  const authStore = useAuthStore()

  // ========================================
  // State
  // ========================================

  /** Center lane — back-compat names unchanged for existing readers. */
  const currentPlayback = computed(() => giftStore.currentPlayback)
  const isPlaying = computed(() => giftStore.isPlaying)
  const comboCount = computed(() => giftStore.comboCount)
  const isSender = computed(() => authStore.user?.id === currentPlayback.value?.senderId)

  /** Side lanes — fixed-length array of SIDE_LANES slots (null = empty). */
  const currentSides = computed(() => giftStore.currentSides)

  const isMinimized = ref(false)

  // ========================================
  // Playback Timeout (Safety Net) — one per lane slot
  // ========================================

  type TimerKey = 'center' | `side-${number}`

  const timeoutIds = new Map<TimerKey, ReturnType<typeof setTimeout>>()
  /** Timestamp of the last (re-)arm per lane slot — throttles heartbeat re-arms */
  const lastArmedAt = new Map<TimerKey, number>()

  /** Minimum gap between heartbeat re-arms — players emit progress up to ~30×/s */
  const REARM_THROTTLE_MS = 1000

  function keyFor(lane: 'center' | 'side', sideIndex?: number): TimerKey {
    return lane === 'center' ? 'center' : (`side-${sideIndex ?? 0}` as TimerKey)
  }

  function clearPlaybackTimeoutFor(key: TimerKey): void {
    const id = timeoutIds.get(key)
    if (id) {
      clearTimeout(id)
      timeoutIds.delete(key)
    }
  }

  function startPlaybackTimeoutFor(key: TimerKey, lane: 'center' | 'side', sideIndex?: number): void {
    clearPlaybackTimeoutFor(key)
    lastArmedAt.set(key, Date.now())
    const id = setTimeout(() => {
      handleComplete(lane, sideIndex)
    }, GIFT_PLAYBACK_TIMEOUT_MS)
    timeoutIds.set(key, id)
  }

  /** Clear the center playback timeout (back-compat name for external callers/tests). */
  function clearPlaybackTimeout(): void {
    clearPlaybackTimeoutFor('center')
  }

  /**
   * Playback heartbeat — players emit `progress` while frames advance.
   * Re-arms the stall timeout so a healthy animation of any duration is
   * never cut off; the timer only fires after GIFT_PLAYBACK_TIMEOUT_MS
   * of genuine silence (never started, or froze mid-play).
   * @param lane - defaults to 'center' so existing call sites keep working.
   */
  function handleProgress(lane: 'center' | 'side' = 'center', sideIndex?: number): void {
    const key = keyFor(lane, sideIndex)
    if (!timeoutIds.has(key)) return
    const armedAt = lastArmedAt.get(key) ?? 0
    if (Date.now() - armedAt < REARM_THROTTLE_MS) return
    startPlaybackTimeoutFor(key, lane, sideIndex)
  }

  // ========================================
  // Core Methods
  // ========================================

  /**
   * Handle playback completion — advances the given lane.
   * @param lane - defaults to 'center' so existing call sites keep working.
   */
  function handleComplete(lane: 'center' | 'side' = 'center', sideIndex?: number): void {
    clearPlaybackTimeoutFor(keyFor(lane, sideIndex))
    giftStore.onPlaybackComplete(lane, sideIndex)
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
        startPlaybackTimeoutFor('center', 'center')
      }
      else {
        clearPlaybackTimeoutFor('center')
        isMinimized.value = false
      }
    },
  )

  // Same, per side lane slot.
  for (let i = 0; i < SIDE_LANES; i++) {
    const index = i
    watch(
      () => currentSides.value[index]?.id,
      (id) => {
        const key = keyFor('side', index)
        if (id) {
          startPlaybackTimeoutFor(key, 'side', index)
        }
        else {
          clearPlaybackTimeoutFor(key)
        }
      },
    )
  }

  // Cleanup all timeouts on scope disposal
  onScopeDispose(() => {
    for (const key of timeoutIds.keys()) clearPlaybackTimeoutFor(key)
  })

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
    currentSides,

    // Methods
    handleComplete,
    handleProgress,
    toggleMinimize,
    clearPlaybackTimeout,
  }
}
