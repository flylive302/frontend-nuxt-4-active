/**
 * VAP Player Composable
 *
 * Manages VAP alpha-video playback with lifecycle hooks and completion events.
 * Mirrors useSvgaPlayer.ts — same API shape for consistency.
 *
 * @see useVapPlayer for SVGA equivalent
 */
import type { Ref } from 'vue'
import type { VapPlayer, VapPlugin } from '~/types/asset/vap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[VapPlayer]')

export interface UseVapPlayerOptions {
  /** Video URL — can include .mp4 extension, .json is derived automatically */
  name: Ref<string>
  /** Loop count (0 = infinite, 1 = play once). Default: 1 */
  loop?: Ref<number>
  /** Whether to start immediately. Default: true */
  autoplay?: Ref<boolean>
  /** Whether to mute audio. Default: true */
  muted?: Ref<boolean>
  /** Called when all loops complete */
  onComplete?: () => void
}

export function useVapPlayer(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseVapPlayerOptions,
) {
  // SSR guard
  if (!import.meta.client) {
    return {
      player: ref(null),
      isPlaying: ref(false),
      reload: () => Promise.resolve(),
      restart: () => {},
      stop: () => {},
    }
  }

  const player = shallowRef<VapPlayer | null>(null)
  const isPlaying = ref(false)
  const nuxtApp = useNuxtApp()

  /** Playback ID to invalidate stale callbacks when restarting */
  let playbackId = 0

  /** Guard flag — prevents stale async loads from assigning to unmounted components */
  let isDestroyed = false

  /**
   * Load and initialize the VAP player
   */
  const load = async () => {
    if (!canvas.value || isDestroyed) return

    // Defensive check — ensure name ref has a value
    const animationName = options.name?.value
    if (!animationName) {
      log.warn('No animation name provided, skipping load')
      return
    }

    // Cleanup existing player
    player.value?.destroy()

    // Increment playback ID to invalidate any pending callbacks
    const currentPlaybackId = ++playbackId

    try {
      // Create new player instance
      const newPlayer = await (nuxtApp.$vap as VapPlugin).createVapPlayer({
        canvas: canvas.value,
        name: animationName,
        loop: options.loop?.value ?? 1,
        autoplay: options.autoplay?.value ?? true,
        muted: options.muted?.value ?? true,
      })

      // Guard: component unmounted during async load — discard the player
      if (isDestroyed) {
        newPlayer?.destroy()
        return
      }

      player.value = newPlayer

      // Register event callbacks
      if (player.value) {
        player.value.onStart = () => {
          isPlaying.value = true
        }

        player.value.onEnd = () => {
          // Only fire if this playback is still current (prevents stale callbacks)
          if (currentPlaybackId !== playbackId) return
          isPlaying.value = false
          options.onComplete?.()
        }

        player.value.onStop = () => {
          isPlaying.value = false
        }
      }
    }
    catch (error) {
      log.error('Failed to load animation:', options.name.value, error)
      isPlaying.value = false
      // Signal completion to prevent stuck modal
      options.onComplete?.()
    }
  }

  /**
   * Restart the animation from the beginning
   */
  function restart() {
    if (player.value) {
      // Increment playback ID to invalidate any pending onEnd callbacks
      const currentPlaybackId = ++playbackId

      player.value.onEnd = () => {
        if (currentPlaybackId !== playbackId) return
        isPlaying.value = false
        options.onComplete?.()
      }

      player.value.restart()
    }
  }

  /**
   * Stop the animation
   */
  function stop() {
    player.value?.stop()
    isPlaying.value = false
  }

  // Watch for option changes and reload
  watch(
    [options.name, options.loop ?? ref(), options.autoplay ?? ref()],
    load,
  )

  // Initialize on mount
  onMounted(load)

  // Cleanup on unmount
  onBeforeUnmount(() => {
    isDestroyed = true
    player.value?.destroy()
    player.value = null
  })

  return {
    player,
    isPlaying,
    reload: load,
    restart,
    stop,
  }
}
