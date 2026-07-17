/**
 * SVGA Player Composable
 *
 * Manages SVGA animation playback with lifecycle hooks and completion events.
 * Uses SVGAPlayer-Web-Lite: https://github.com/svga/SVGAPlayer-Web-Lite
 */
import type { Ref } from 'vue';
import type { SvgaPlayer, SvgaPlugin } from '@/types/asset/svga';
import { createLogger } from '~/utils/logger';
import * as motionPauseRegistry from '~/services/motionPauseRegistry';

const log = createLogger('[SvgaPlayer]');

export interface UseSvgaPlayerOptions {
  name: Ref<string>;
  loop?: Ref<number>;
  autoplay?: Ref<boolean>;
  onComplete?: () => void;
  /** Called on each rendered frame — playback heartbeat */
  onProcess?: () => void;
  replaceElements?: Record<string, HTMLImageElement>;
  dynamicElements?: Record<string, HTMLCanvasElement>;
  /**
   * Participate in the global motion-pause registry (room-battery-perf/03).
   * Default true. Set false for one-shot players whose `complete` event gates
   * downstream flow (e.g. the gift playback queue) — freezing those mid-play
   * would stall the queue rather than save meaningful work.
   */
  motionPause?: boolean;
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
      return;
    }

    // Cleanup existing player
    player.value?.destroy();
    player.value = null;

    // Increment playback ID to invalidate any pending callbacks AND stale concurrent loads
    const currentPlaybackId = ++playbackId;

    try {
      // Load without autoplay so we can register callbacks before the first frame runs
      const newPlayer = await (nuxtApp.$svga as SvgaPlugin).createSvgaPlayer({
        canvas: canvas.value,
        name: animationName,
        loop: options.loop?.value ?? 1,
        autoplay: false,
        replaceElements: options.replaceElements,
        dynamicElements: options.dynamicElements,
      });

      // Guard: component unmounted during async load — discard the player
      if (isDestroyed) {
        newPlayer?.destroy();
        return;
      }

      // Guard: a newer load started while we were awaiting — discard this stale result.
      // Without this, two players can end up rendering to the same canvas simultaneously,
      // causing rapid visual toggling between the two animations.
      if (currentPlaybackId !== playbackId) {
        newPlayer?.destroy();
        return;
      }

      player.value = newPlayer;

      // Register callbacks before start() so onEnd is always set before the first frame
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

      player.value.onProcess = () => {
        if (currentPlaybackId !== playbackId) return;
        options.onProcess?.();
      };

      if (options.autoplay?.value !== false) {
        player.value.start();
        // room-battery-perf/03: a player loaded while the app is already
        // paused (backgrounded/covered) must not start animating — the
        // registry's inherited pause() fired before this player existed.
        if (participatesInMotionPause && motionPauseRegistry.isPaused()) {
          player.value.pause();
          pausedByRegistry = true;
        }
      }
    } catch (error) {
      log.warn('Failed to load SVGA animation', error);
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

  // room-battery-perf/03: register with the global motion-pause registry so
  // backgrounding/covering the room halts this canvas loop. Resume only
  // touches players THIS registrant paused — a player that finished or was
  // stopped while backgrounded must not be restarted by resume().
  let pausedByRegistry = false;
  const participatesInMotionPause = options.motionPause !== false;
  const registryId = participatesInMotionPause
    ? motionPauseRegistry.register({
        pause: () => {
          if (player.value && isPlaying.value) {
            player.value.pause();
            pausedByRegistry = true;
          }
        },
        resume: () => {
          if (player.value && pausedByRegistry) {
            player.value.resume();
          }
          pausedByRegistry = false;
        },
      })
    : null;

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
    if (registryId !== null) motionPauseRegistry.unregister(registryId);
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