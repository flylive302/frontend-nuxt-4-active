/**
 * Seat Reaction Player Composable (ADR 0015 / seat-reactions slice 01)
 *
 * Owns the `@lottiefiles/dotlottie-web` instance lifecycle so the player
 * component stays INTENT-only. Implements the playback rule from
 * `planReactionPlayback`: loop until the intrinsic duration read at
 * `load` has repeated enough times to clear REACTION_MIN_DISPLAY_MS, then
 * finish the current loop and report done.
 *
 * `dotlottie-web` only exposes a boolean `loop` (no native loop-count), so
 * loops are counted manually via the `loop` event and `setLoop(false)` is
 * called on the final pass so `complete` fires exactly once, at the end.
 */
import type { Ref } from 'vue';
import { DotLottie } from '@lottiefiles/dotlottie-web';
import { getReactionLottieUrl } from '~/constants/reactions';
import { planReactionPlayback } from '~/utils/planReactionPlayback';
import { createLogger } from '~/utils/logger';

const log = createLogger('[SeatReactionPlayer]');

export interface UseSeatReactionPlayerOptions {
  code: string;
  /** Called exactly once — playback finished (or failed to load). */
  onDone: () => void;
}

export interface UseSeatReactionPlayerReturn {
  /** Create the DotLottie instance against the bound canvas and start playback. */
  init: () => void;
  /** Tear down the DotLottie instance. Safe to call multiple times. */
  destroy: () => void;
}

export function useSeatReactionPlayer(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseSeatReactionPlayerOptions,
): UseSeatReactionPlayerReturn {
  let instance: DotLottie | null = null;
  let completedLoops = 0;
  let targetLoops = 1;
  let done = false;

  function reportDone(): void {
    if (done) return;
    done = true;
    destroy();
    options.onDone();
  }

  function onLoad(): void {
    if (!instance) return;
    const durationMs = instance.duration * 1000;
    targetLoops = planReactionPlayback(durationMs).loops;
    if (targetLoops <= 1) {
      instance.setLoop(false);
    }
  }

  function onLoop(): void {
    completedLoops += 1;
    // One loop remaining — stop looping so `complete` fires after it finishes.
    if (completedLoops >= targetLoops - 1) {
      instance?.setLoop(false);
    }
  }

  function onComplete(): void {
    reportDone();
  }

  function onLoadError(): void {
    log.warn('Reaction Lottie failed to load, clearing reaction', { code: options.code });
    reportDone();
  }

  function init(): void {
    if (!canvas.value) {
      reportDone();
      return;
    }

    instance = new DotLottie({
      canvas: canvas.value,
      src: getReactionLottieUrl(options.code),
      autoplay: true,
      loop: true,
    });

    instance.addEventListener('load', onLoad);
    instance.addEventListener('loop', onLoop);
    instance.addEventListener('complete', onComplete);
    instance.addEventListener('loadError', onLoadError);
  }

  function destroy(): void {
    instance?.removeEventListener('load', onLoad);
    instance?.removeEventListener('loop', onLoop);
    instance?.removeEventListener('complete', onComplete);
    instance?.removeEventListener('loadError', onLoadError);
    instance?.destroy();
    instance = null;
  }

  return { init, destroy };
}
