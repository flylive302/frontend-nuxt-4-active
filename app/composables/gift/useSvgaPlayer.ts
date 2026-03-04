/**
 * SVGA Player Composable
 *
 * Manages SVGA animation playback with lifecycle hooks and completion events.
 * Uses SVGAPlayer-Web-Lite: https://github.com/svga/SVGAPlayer-Web-Lite
 */
import type { Ref } from 'vue';
import type { SvgaPlayer, SvgaPlugin } from '@/types/asset/svga';
import { createLogger } from '~/utils/logger';

const log = createLogger('[SvgaPlayer]');

export interface UseSvgaPlayerOptions {
  name: Ref<string>;
  loop?: Ref<number>;
  autoplay?: Ref<boolean>;
  onComplete?: () => void;
}

export function useSvgaPlayer(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseSvgaPlayerOptions
) {
  // SSR guard
  if (!import.meta.client) {
    return {
      player: ref(null),
      isPlaying: ref(false),
      reload: () => Promise.resolve(),
      restart: () => {},
    };
  }

  const player = shallowRef<SvgaPlayer | null>(null);
  const isPlaying = ref(false);
  const nuxtApp = useNuxtApp();

  /** Playback ID to invalidate stale callbacks when restarting */
  let playbackId = 0;

  /** Guard flag — prevents stale async loads from assigning to unmounted components */
  let isDestroyed = false;

  /**
   * Load and initialize the SVGA player
   */
  const load = async () => {
    if (!canvas.value || isDestroyed) return;
    
    // Defensive check - ensure name ref has a value
    const animationName = options.name?.value;
    if (!animationName) {
      log.warn('No animation name provided, skipping load');
      return;
    }

    // Cleanup existing player
    player.value?.destroy();

    // Increment playback ID to invalidate any pending callbacks
    const currentPlaybackId = ++playbackId;

    try {
      // Create new player instance
      const newPlayer = await (nuxtApp.$svga as SvgaPlugin).createSvgaPlayer({
        canvas: canvas.value,
        name: animationName,
        loop: options.loop?.value ?? 1,
        autoplay: options.autoplay?.value ?? true,
      });

      // Guard: component unmounted during async load — discard the player
      if (isDestroyed) {
        newPlayer?.destroy();
        return;
      }

      player.value = newPlayer;

      // Register event callbacks
      if (player.value) {
        player.value.onStart = () => {
          isPlaying.value = true;
        };

        player.value.onEnd = () => {
          // Only fire if this playback is still current (prevents stale callbacks during combo)
          if (currentPlaybackId !== playbackId) return;
          isPlaying.value = false;
          options.onComplete?.();
        };

        player.value.onStop = () => {
          isPlaying.value = false;
        };
      }
    } catch (error) {
      log.error('Failed to load animation:', options.name.value, error);
      isPlaying.value = false;
      // Signal completion to prevent stuck modal
      options.onComplete?.();
    }
  };

  /**
   * Restart the animation from the beginning
   */
  function restart() {
    if (player.value) {
      // Increment playback ID to invalidate any pending onEnd callbacks
      const currentPlaybackId = ++playbackId;
      player.value.stop();

      // Re-register onEnd callback with the new playbackId
      // This ensures the completion event fires after combo restarts
      player.value.onEnd = () => {
        if (currentPlaybackId !== playbackId) return;
        isPlaying.value = false;
        options.onComplete?.();
      };

      player.value.start();
    }
  }

  /**
   * Stop the animation
   */
  function stop() {
    player.value?.stop();
    isPlaying.value = false;
  }

  // Watch for option changes and reload
  watch(
    [options.name, options.loop ?? ref(), options.autoplay ?? ref()],
    load
  );

  // Initialize on mount
  onMounted(load);

  // Cleanup on unmount
  onBeforeUnmount(() => {
    isDestroyed = true;
    player.value?.destroy();
    player.value = null;
  });

  return {
    player,
    isPlaying,
    reload: load,
    restart,
    stop,
  };
}