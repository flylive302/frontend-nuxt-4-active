/**
 * Gift Playback Composable
 *
 * Single source of truth for gift playback orchestration.
 * Manages player refs, playback timeout, combo state, and minimize toggle.
 * Used by playback-modal.vue as a thin presentation component.
 */
import { GIFT_PLAYBACK_TIMEOUT_MS } from '~/constants/gift'
import { createLogger } from '~/utils/logger'

// ========================================
// Types
// ========================================

interface PlaybackController {
  restart: () => void
}

// ========================================
// Composable
// ========================================

export function useGiftPlayback() {
  const log = createLogger('[GiftPlayback]')
  const giftStore = useGiftStore()
  const authStore = useAuthStore()

  // ========================================
  // Player Refs
  // ========================================

  const videoPlayerRef = ref<PlaybackController | null>(null)
  const svgaPlayerRef = ref<PlaybackController | null>(null)
  const staticDisplayRef = ref<PlaybackController | null>(null)

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

  /** Start the playback timeout — force completes if animation stalls */
  function startPlaybackTimeout(): void {
    clearPlaybackTimeout()
    playbackTimeoutId = setTimeout(() => {
      log.warn('Timeout reached — force closing playback')
      handleComplete()
    }, GIFT_PLAYBACK_TIMEOUT_MS)
  }

  // ========================================
  // Core Methods
  // ========================================

  /** Handle playback completion — advances to next in queue */
  function handleComplete(): void {
    clearPlaybackTimeout()
    giftStore.onPlaybackComplete()
  }

  /**
   * Restart current animation (for combo mode).
   * Routes to the correct player based on asset type.
   */
  function restartCurrentPlayer(): void {
    const assetType = currentPlayback.value?.gift.asset_type

    switch (assetType) {
      case 'video':
        videoPlayerRef.value?.restart()
        break
      case 'svga':
        svgaPlayerRef.value?.restart()
        break
      case 'image':
        staticDisplayRef.value?.restart()
        break
    }
  }

  /** Register a player ref for restart control */
  function registerPlayer(
    type: 'video' | 'svga' | 'static',
    controller: PlaybackController | null,
  ): void {
    switch (type) {
      case 'video':
        videoPlayerRef.value = controller
        break
      case 'svga':
        svgaPlayerRef.value = controller
        break
      case 'static':
        staticDisplayRef.value = controller
        break
    }
  }

  // ========================================
  // Combo Handling
  // ========================================

  /**
   * Handle combo button click — deducts coins, emits socket, restarts animation.
   * Delegates the actual sending to useGiftSending.combo().
   */
  async function handleCombo(comboFn: () => Promise<boolean>): Promise<void> {
    const success = await comboFn()

    if (success) {
      restartCurrentPlayer()
      startPlaybackTimeout()
    }
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

  // Reset state when playback starts/stops
  watch(isPlaying, (open) => {
    if (open) {
      startPlaybackTimeout()
    }
    else {
      clearPlaybackTimeout()
      isMinimized.value = false
    }
  })

  // Watch for combo restarts from other users (timestamp changes)
  watch(
    () => currentPlayback.value?.timestamp,
    (newTimestamp, oldTimestamp) => {
      if (newTimestamp && oldTimestamp && newTimestamp !== oldTimestamp) {
        restartCurrentPlayer()
        startPlaybackTimeout()
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

    // Player refs (for template binding)
    videoPlayerRef,
    svgaPlayerRef,
    staticDisplayRef,

    // Methods
    handleComplete,
    restartCurrentPlayer,
    registerPlayer,
    handleCombo,
    toggleMinimize,
    clearPlaybackTimeout,
  }
}
