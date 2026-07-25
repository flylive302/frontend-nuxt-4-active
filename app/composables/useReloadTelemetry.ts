/**
 * Reload telemetry orchestrator.
 *
 * GATE    — consume the markers the previous page session left behind, and
 *           decide whether there is anything to report at all.
 * EXECUTE — observe what the reload actually cost the user: did they land back
 *           in their room, or were they ejected?
 * REACT   — emit exactly one queryable record, fire-and-forget.
 *
 * The mechanics of *what* is recorded live in `~/utils/reload-telemetry`; this
 * composable owns only the pipeline and the outcome observation, which needs
 * Vue reactivity and therefore cannot live in a util.
 */

import * as Sentry from '@sentry/nuxt';
import { createLogger } from '~/utils/logger';
import { classifyDeviceClass, readDeviceCapabilities } from '~/utils/device-class';
import {
  consumePendingReload,
  isRoomPath,
  routePatternOf,
  sessionAgeBucket,
  type PendingReload,
  type ReloadOutcome,
} from '~/utils/reload-telemetry';
import { RELOAD_OUTCOME_TIMEOUT_MS } from '~/constants/telemetry';

const log = createLogger('[ReloadTelemetry]');

/** Sentry message text. Constant so every record groups into one issue. */
const RELOAD_MESSAGE = 'Client reload';

export function useReloadTelemetry() {
  // ========================================
  // GATE
  // ========================================

  /**
   * Read and clear the previous session's markers.
   *
   * Must be called at boot, before the in-room heartbeat overwrites the
   * snapshot with this session's state. Touches storage only, so it is safe to
   * call from a plugin body before Pinia or the router exist.
   */
  function consume(): PendingReload | null {
    return consumePendingReload();
  }

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Resolve what the reload cost the user.
   *
   * Observed rather than signalled: watching the room the user ends up in
   * measures the thing that actually matters and keeps this decoupled from the
   * rehydration path it is grading. A reload that was not in a room has no
   * outcome to grade.
   */
  function observeOutcome(pending: PendingReload): Promise<ReloadOutcome> {
    if (!pending.inRoom || pending.roomId === null) {
      return Promise.resolve('not-in-room');
    }

    const roomId = pending.roomId;
    const roomStore = useRoomStore();
    const router = useRouter();

    return new Promise<ReloadOutcome>((resolve) => {
      let settled = false;
      let stopWatch: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function settle(outcome: ReloadOutcome): void {
        if (settled) return;
        settled = true;
        stopWatch?.();
        if (timer) clearTimeout(timer);
        resolve(outcome);
      }

      function check(): void {
        // Recovered the moment the store holds the room again — this is what
        // ticket 01's rehydration produces on success.
        if (roomStore.currentRoom?.id === roomId) return settle('recovered');
        // Ejected the moment we are no longer on that room's route. Covers both
        // rehydration failing (it redirects) and booting straight to `/`, which
        // is what a renderer kill restarting the shell looks like.
        if (!isRoomPath(router.currentRoute.value.path, roomId)) return settle('ejected');
      }

      // A boot that is already off the room route resolves synchronously; the
      // in-room case sits on the room route with an empty store and must wait.
      check();
      if (settled) return;

      stopWatch = watch(
        () => [roomStore.currentRoom?.id ?? null, router.currentRoute.value.path] as const,
        check,
      );
      timer = setTimeout(() => settle('unknown'), RELOAD_OUTCOME_TIMEOUT_MS);
    });
  }

  // ========================================
  // REACT
  // ========================================

  /**
   * Emit the record. Never throws — telemetry does not get to break a boot.
   *
   * `release` is passed in rather than read here: this runs from a promise
   * callback, where the Nuxt instance is no longer the ambient context, and
   * `useRuntimeConfig()` would throw for *every* record — silently killing the
   * instrument rather than just this field.
   */
  function emit(pending: PendingReload, outcome: ReloadOutcome, release: string): void {
    try {
      Sentry.captureMessage(RELOAD_MESSAGE, {
        // An ejection is a real user harm and belongs in the default issue
        // stream; a clean recovery is informational. Both stay one issue —
        // Sentry groups on the message, not the level.
        level: outcome === 'ejected' ? 'warning' : 'info',
        tags: {
          source: 'reload-telemetry',
          reload_cause: pending.cause,
          reload_outcome: outcome,
          in_room: String(pending.inRoom),
          seated: String(pending.seated),
          minimized: String(pending.minimized),
          was_backgrounded: String(pending.wasBackgrounded),
          device_class: classifyDeviceClass(readDeviceCapabilities()),
          session_age: sessionAgeBucket(pending.sessionAgeMs),
          route_pattern: routePatternOf(pending.route),
        },
        extra: {
          detail: pending.detail,
          route: pending.route,
          roomId: pending.roomId,
          sessionAgeMs: pending.sessionAgeMs,
          release,
        },
      });

      log.info('Reload recorded', pending.cause, outcome);
    } catch (error) {
      log.warn('Reload record dropped', error);
    }
  }

  // ========================================
  // Orchestrator
  // ========================================

  /**
   * Grade and record a consumed reload. Fire-and-forget by design — the caller
   * is a boot hook and must never wait on telemetry.
   */
  function report(pending: PendingReload | null): void {
    if (!pending) return;

    // Read while still inside the synchronous Nuxt context — see `emit`.
    const release = String(useRuntimeConfig().public.sentry?.release ?? '');

    observeOutcome(pending)
      .then((outcome) => emit(pending, outcome, release))
      .catch((error) => log.warn('Reload outcome unresolved', error));
  }

  return { consume, report };
}
