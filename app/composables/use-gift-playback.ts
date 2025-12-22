/**
 * Gift Playback Composable
 *
 * Orchestrates gift playback with support for combo mode.
 * Provides unified interface for restarting animations across player types.
 */

interface PlaybackController {
  restart: () => void;
}

export function useGiftPlayback() {
  const giftStore = useGiftStore();

  // Player refs for restart control
  const videoPlayerRef = ref<PlaybackController | null>(null);
  const svgaPlayerRef = ref<PlaybackController | null>(null);
  const staticDisplayRef = ref<PlaybackController | null>(null);

  // Playback state from store
  const currentPlayback = computed(() => giftStore.currentPlayback);
  const isPlaying = computed(() => giftStore.isPlaying);
  const comboCount = computed(() => giftStore.comboCount);

  /**
   * Handle playback completion - advances to next in queue
   */
  function handleComplete() {
    giftStore.onPlaybackComplete();
  }

  /**
   * Restart current animation (for combo mode)
   * Routes to the correct player based on asset type
   */
  function restartCurrentPlayer() {
    const assetType = currentPlayback.value?.gift.asset_type;

    switch (assetType) {
      case 'video':
        videoPlayerRef.value?.restart();
        break;
      case 'svga':
        svgaPlayerRef.value?.restart();
        break;
      case 'static':
        staticDisplayRef.value?.restart();
        break;
    }
  }

  /**
   * Register a player ref for restart control
   */
  function registerPlayer(
    type: 'video' | 'svga' | 'static',
    controller: PlaybackController | null
  ) {
    switch (type) {
      case 'video':
        videoPlayerRef.value = controller;
        break;
      case 'svga':
        svgaPlayerRef.value = controller;
        break;
      case 'static':
        staticDisplayRef.value = controller;
        break;
    }
  }

  return {
    // State
    currentPlayback,
    isPlaying,
    comboCount,

    // Player refs (for template binding)
    videoPlayerRef,
    svgaPlayerRef,
    staticDisplayRef,

    // Methods
    handleComplete,
    restartCurrentPlayer,
    registerPlayer,
  };
}
