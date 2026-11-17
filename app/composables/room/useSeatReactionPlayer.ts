/**
 * Seat Reaction Player Composable (ADR 0015 / seat-reactions slice 01)
 *
 * Owns the `@lottiefiles/dotlottie-web` instance lifecycle so the player
 * component stays INTENT-only. Implements the playback rule from
 * `planReactionPlayback`: loop until the intrinsic duration read at
 * `load` has repeated enough times to clear REACTION_MIN_DISPLAY_MS, then
 * finish the current loop and report done-issues.
 *
 * `dotlottie-web` only exposes a boolean `loop` (no native loop-count), so
 * loops are counted manually via the `loop` event and `setLoop(false)` is
 * called on the final pass so `complete` fires exactly once, at the end.
 *
 * boot-and-asset-delivery/08: `dotlottie-web` is lazy-loaded on first use
 * (mirrors `useMediasoupDevice`'s `getDeviceClass` / `svga-player.client.ts`'s
 * `ensureSvga` pattern) so it never ships in the room bundle for a session
 * that never plays a seat reaction.
 *
 * android-client-performance/17 fix 2: playback runs in `DotLottieWorker`
 * (OffscreenCanvas, one shared worker) where the WebView supports it. The
 * main-thread `DotLottie` ran a wasm render inside a `requestAnimationFrame`
 * loop (~3 s of main-thread time per 41 s in a reacting room on the A6x), and
 * every one of those rAF ticks forced a main frame that re-ticked all CSS
 * animations. The worker draws off the main thread with the same visuals.
 * Same API shape; `setLoop`/`destroy` become async messages (a late
 * `setLoop(false)` lands within ms, far inside one loop). WebViews without
 * `transferControlToOffscreen` keep the main-thread player.
 */
import type { Ref } from 'vue';
import { getReactionLottieUrl, REACTION_LOTTIE_WORKER_ID } from '~/constants/reactions';
import { planReactionPlayback } from '~/utils/planReactionPlayback';
import { createLogger } from '~/utils/logger';

const log = createLogger('[SeatReactionPlayer]');

type DotLottieModule = typeof import('@lottiefiles/dotlottie-web');
type DotLottieInstance =
  | InstanceType<DotLottieModule['DotLottie']>
  | InstanceType<DotLottieModule['DotLottieWorker']>;

let _module: DotLottieModule | null = null;
async function getDotLottieModule(): Promise<DotLottieModule> {
  if (!_module) _module = await import('@lottiefiles/dotlottie-web');
  return _module;
}

/** OffscreenCanvas transfer is what lets the worker draw into our canvas. */
function supportsWorkerRender(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
}

function createPlayer(mod: DotLottieModule, canvas: HTMLCanvasElement, code: string): DotLottieInstance {
  const config = { canvas, src: getReactionLottieUrl(code), autoplay: true, loop: true };
  return supportsWorkerRender()
    ? new mod.DotLottieWorker({ ...config, workerId: REACTION_LOTTIE_WORKER_ID })
    : new mod.DotLottie(config);
}

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
  let instance: DotLottieInstance | null = null;
  let completedLoops = 0;
  let targetLoops = 1;
  let done = false;
  /** Set by destroy() — guards against the lazy chunk resolving after teardown. */
  let cancelled = false;
  /** The player reported `load` or `loadError` — its async create has finished. */
  let settled = false;

  function reportDone(): void {
    if (done) return;
    done = true;
    destroy();
    options.onDone();
  }

  function onLoad(): void {
    settled = true;
    if (!instance) return;
    const durationMs = instance.duration * 1000;
    targetLoops = planReactionPlayback(durationMs).loops;
    if (targetLoops <= 1) {
      void Promise.resolve(instance.setLoop(false)).catch(logAsyncFailure);
    }
  }

  function onLoop(): void {
    completedLoops += 1;
    // One loop remaining — stop looping so `complete` fires after it finishes.
    if (completedLoops >= targetLoops - 1) {
      if (instance) void Promise.resolve(instance.setLoop(false)).catch(logAsyncFailure);
    }
  }

  function onComplete(): void {
    reportDone();
  }

  function onLoadError(): void {
    settled = true;
    log.warn('Reaction Lottie failed to load, clearing reaction', { code: options.code });
    reportDone();
  }

  function init(): void {
    if (!canvas.value) {
      reportDone();
      return;
    }

    // Fire-and-forget: init() stays sync for the caller (onMounted); the
    // dotlottie-web chunk loads on first reaction, not on module import.
    void getDotLottieModule()
      .then((mod) => {
        // Torn down (or already done) while the chunk was loading.
        if (cancelled || done || !canvas.value) return;

        instance = createPlayer(mod, canvas.value, options.code);

        instance.addEventListener('load', onLoad);
        instance.addEventListener('loop', onLoop);
        instance.addEventListener('complete', onComplete);
        instance.addEventListener('loadError', onLoadError);
      })
      .catch((error) => {
        log.warn('Failed to load dotlottie-web', { error, code: options.code });
        reportDone();
      });
  }

  function destroy(): void {
    cancelled = true;
    instance?.removeEventListener('load', onLoad);
    instance?.removeEventListener('loop', onLoop);
    instance?.removeEventListener('complete', onComplete);
    instance?.removeEventListener('loadError', onLoadError);
    if (instance) {
      const player = instance;
      const teardown = (): void => {
        void Promise.resolve(player.destroy()).catch(logAsyncFailure);
      };
      teardown();
      // DotLottieWorker.destroy() is a no-op until its async `create` round-trip
      // has finished (`_created`, dotlottie-web 0.77). A seat unmounted before
      // then would leave the animation looping in the worker — so destroy again
      // once the player settles. A second destroy() on a torn-down player is a no-op.
      if (!settled) {
        player.addEventListener('load', teardown);
        player.addEventListener('loadError', teardown);
      }
    }
    instance = null;
  }

  function logAsyncFailure(error: unknown): void {
    log.warn('dotlottie-web call failed', { error, code: options.code });
  }

  return { init, destroy };
}
