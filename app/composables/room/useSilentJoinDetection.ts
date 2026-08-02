/**
 * Silent-join detection orchestrator (observability-audio-quality 13).
 *
 * GATE    — only observe a join that completed, on the client, in a room the
 *           user is still in.
 * EXECUTE — watch for the one piece of evidence that audio is genuinely
 *           arriving: an attached audio element whose `currentTime` advances.
 * REACT   — emit at most one queryable record per join, fire-and-forget.
 *
 * The rule that grades the observation lives in `~/utils/silent-join`; this
 * composable owns only the timers, the store reads and the reporting, which
 * need Vue reactivity and therefore cannot live in a util. Same split as
 * `useReloadTelemetry` / `utils/reload-telemetry`.
 *
 * ⛔ **Detection only.** Nothing here changes what the user sees or hears: no
 * toast, no retry, no playback recovery. Surfacing or recovering from a silent
 * join is a product decision that follows from the measurement and is out of
 * scope for this epic.
 */

import * as Sentry from '@sentry/nuxt';
import { createLogger } from '~/utils/logger';
import { classifyDeviceClass, readDeviceCapabilities } from '~/utils/device-class';
import {
  resolveJoinAudioOutcome,
  isReportableJoinOutcome,
  silentJoinStage,
  type JoinAudioCheckpoint,
  type JoinAudioOutcome,
} from '~/utils/silent-join';
import {
  SILENT_JOIN_DEADLINE_MS,
  SILENT_JOIN_LATE_WINDOW_MS,
  SILENT_JOIN_ADVANCE_SAMPLE_MS,
} from '~/constants/telemetry';
import { useMediasoupSessionStore } from '~/stores/mediasoupSession';

const log = createLogger('[SilentJoin]');

/** Sentry message text. Constant so every record groups into one issue. */
const SILENT_JOIN_MESSAGE = 'Room join audio outcome';

export interface SilentJoinWatchHandle {
  /**
   * Abandon the observation without reporting.
   *
   * Load-bearing: a user who leaves after four seconds never gave the join a
   * chance to deliver audio, and reporting them would be the instrument's
   * largest source of false positives.
   */
  cancel: () => void;
}

export function useSilentJoinDetection() {
  const session = useMediasoupSessionStore();

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Whether any attached audio element's playback position moved.
   *
   * The same two-sample technique `probeAudioHealth()` uses, at the same
   * interval — deliberately not re-derived. A resolved `audio.play()` only
   * means the element accepted the track, and a successful `audio:consume` ack
   * only means signalling worked; neither implies a packet arrived.
   *
   * Reads `paused` as well, because a paused element's `currentTime` is
   * legitimately frozen and must not be mistaken for a stalled stream.
   */
  async function audioIsAdvancing(): Promise<boolean> {
    const elements = session.audioElements;
    if (elements.size === 0) return false;

    const before = new Map<string, number>();
    for (const [producerId, audio] of elements) {
      before.set(producerId, audio.currentTime);
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, SILENT_JOIN_ADVANCE_SAMPLE_MS),
    );

    for (const [producerId, audio] of session.audioElements) {
      if (audio.paused) continue;
      if (audio.currentTime > (before.get(producerId) ?? 0)) return true;
    }

    return false;
  }

  // ========================================
  // REACT
  // ========================================

  /** Emit the record. Never throws — telemetry does not get to break a room. */
  function emit(
    outcome: JoinAudioOutcome,
    context: {
      roomId: number;
      seated: boolean;
      producersAnnounced: number;
      consumersCreated: number;
      observedMs: number;
    },
  ): void {
    try {
      Sentry.captureMessage(SILENT_JOIN_MESSAGE, {
        // A silent join is a user hearing nothing — a real harm, and it belongs
        // in the default issue stream. A late arrival is informational. Both
        // stay one issue; Sentry groups on the message, not the level.
        level: outcome === 'silent' ? 'warning' : 'info',
        tags: {
          source: 'silent-join',
          join_audio_outcome: outcome,
          // Only meaningful for `silent`; carried always so the tag's value set
          // stays closed and a query never has to special-case its absence.
          silent_join_stage: silentJoinStage(context),
          seated: String(context.seated),
          device_class: classifyDeviceClass(readDeviceCapabilities()),
        },
        extra: {
          roomId: context.roomId,
          producersAnnounced: context.producersAnnounced,
          consumersCreated: context.consumersCreated,
          observedMs: context.observedMs,
        },
      });

      log.info('Join audio outcome recorded', outcome);
    } catch (error) {
      log.warn('Join audio record dropped', error);
    }
  }

  // ========================================
  // Orchestrator
  // ========================================

  /**
   * Start observing a completed join.
   *
   * Fire-and-forget by design — the caller is the join path and must never wait
   * on, or fail because of, telemetry. The returned handle exists so the room
   * lifecycle can abandon the observation on leave.
   *
   * `joinCompleted` is always true from the only current call site: the
   * detector is started after a successful join, and an outright failed join
   * already returns early before reaching it. The rule still grades that case,
   * so a future caller cannot silently fold a failed join into `silent`.
   */
  function observeJoin(input: { roomId: number; seated: boolean }): SilentJoinWatchHandle {
    // ========================================
    // GATE
    // ========================================
    if (!import.meta.client) return { cancel: () => {} };

    let cancelled = false;
    let stopVolumeWatch: (() => void) | null = null;

    // The counters are read as a DELTA from this baseline, so the observation
    // never depends on when `$reset()` last ran — a rejoin without an
    // intervening leave grades its own producers, not the previous room's.
    const baselineProducers = session.producersAnnounced;
    const baselineConsumers = session.consumers.size;
    const startedAt = Date.now();

    // Sampled continuously rather than read at the end: a user who mutes for
    // two seconds and unmutes has still not given us a fair observation, and a
    // false silent-join costs far more than a missed one.
    let playbackMuted = session.currentVolume === 0;
    stopVolumeWatch = watch(
      () => session.currentVolume,
      (volume) => {
        if (volume === 0) playbackMuted = true;
      },
    );

    function teardown(): void {
      stopVolumeWatch?.();
      stopVolumeWatch = null;
    }

    async function observe(checkpoint: JoinAudioCheckpoint): Promise<JoinAudioOutcome | null> {
      const audioAdvanced = await audioIsAdvancing();
      if (cancelled) return null;

      return resolveJoinAudioOutcome({
        joinCompleted: true,
        playbackMuted,
        producersAnnounced: session.producersAnnounced - baselineProducers,
        consumersCreated: session.consumers.size - baselineConsumers,
        audioAdvanced,
        checkpoint,
      });
    }

    async function run(): Promise<void> {
      await delay(SILENT_JOIN_DEADLINE_MS);
      if (cancelled) return;

      let outcome = await observe('deadline');
      if (cancelled) return;

      // `null` is the rule's "undecided — keep watching", and it is the only
      // path to `flowing-late`.
      if (outcome === null) {
        await delay(SILENT_JOIN_LATE_WINDOW_MS);
        if (cancelled) return;

        outcome = await observe('late');
        if (cancelled || outcome === null) return;
      }

      if (!isReportableJoinOutcome(outcome)) return;

      emit(outcome, {
        roomId: input.roomId,
        seated: input.seated,
        producersAnnounced: session.producersAnnounced - baselineProducers,
        consumersCreated: session.consumers.size - baselineConsumers,
        observedMs: Date.now() - startedAt,
      });
    }

    run()
      .catch((error) => log.warn('Join audio observation failed', error))
      .finally(teardown);

    return {
      cancel: () => {
        cancelled = true;
        teardown();
      },
    };
  }

  return { observeJoin };
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
