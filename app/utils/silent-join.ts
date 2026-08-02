// ========================================
// Silent-join detection
// ========================================
//
// A room join reports success on transport *creation*. The recovery engine
// (`useTransportRecovery.ts`) only fires on an explicit `connectionstatechange`
// to `disconnected`/`failed` — and a silent join is not a failure by that
// definition: the transports came up fine and nothing arrived. So a user can be
// joined, seated, and completely silent while every signal the app has says the
// join worked.
//
// **The server-side percentiles cannot see this.** A consumer that never
// delivered audio produces no quality sample to aggregate, so
// `observability-audio-quality` tickets 01–03 are blind to it by construction.
// That blind spot is why this module exists.
//
// This file is the RULE ONLY — pure, no Vue, no Sentry, no timers. The
// observation and the reporting live in `composables/room/useSilentJoinDetection.ts`.
// Same split as `utils/reload-telemetry.ts`, and for the same reason: the whole
// truth table has to be unit-testable, and the web client has no composable
// test infrastructure.
// ========================================

/**
 * What a join's first seconds turned out to be.
 *
 * Only `silent` is a fault this ticket is hunting. The rest exist so that
 * `silent` means what it says — each one is a case that would otherwise be
 * miscounted as a silent join.
 */
export type JoinAudioOutcome =
  /** Audio started flowing inside the deadline. The healthy path. */
  | 'flowing'
  /** Audio flowed, but only after the deadline. Degraded, not silent. */
  | 'flowing-late'
  /** 🔴 The fault: remote audio was announced, and none of it ever played. */
  | 'silent'
  /** Nothing was announced — an empty or quiet room. There was nothing to hear. */
  | 'idle'
  /** The user muted their own playback. Never gradeable, never a silent join. */
  | 'playback-muted'
  /** The join itself never completed. A different fault, already visible. */
  | 'join-failed';

/**
 * Which of the two checkpoints this observation was taken at.
 *
 * Two, not one, because "arrived late" is a distinct and useful answer: a join
 * that recovers at 12s is a latency problem, and a join that never recovers is
 * a correctness problem. Collapsing them would hide which one is happening.
 */
export type JoinAudioCheckpoint = 'deadline' | 'late';

export interface JoinAudioObservation {
  /** Whether `joinRoom()` ran to completion. */
  joinCompleted: boolean;
  /**
   * Whether the user's own playback volume was zero at ANY point in the window.
   *
   * Deliberately "at any point" rather than "at the end": a user who mutes for
   * two seconds and unmutes has still not given us a fair observation, and a
   * false silent-join is far more costly here than a missed one.
   */
  playbackMuted: boolean;
  /**
   * Remote producers announced to this client during the window.
   *
   * Counted at the single funnel every announcement passes through, **before**
   * the readiness gate — so a producer we were told about and failed to consume
   * still counts. That failure is the most likely cause of a silent join, and
   * counting only successful consumes would make it invisible.
   */
  producersAnnounced: number;
  /** Consumers actually created for those producers. */
  consumersCreated: number;
  /**
   * Whether any attached audio element's `currentTime` advanced.
   *
   * This is the only evidence in the client that bytes are genuinely arriving.
   * A resolved `audio.play()` means the element accepted the track; a
   * successful `audio:consume` ack means signalling worked. Neither means a
   * single RTP packet landed. Same technique as `probeAudioHealth()`, which
   * already proved it works — it is simply never run at join time.
   */
  audioAdvanced: boolean;
  checkpoint: JoinAudioCheckpoint;
}

/**
 * Grade a join's audio. Pure, total, and order-sensitive — the precedence below
 * is the whole design.
 *
 * Returns `null` for "not decided yet, keep watching", which is only ever the
 * deadline checkpoint of a join that currently looks silent. That is what gives
 * `flowing-late` a chance to happen instead of being reported as `silent`.
 */
export function resolveJoinAudioOutcome(
  observation: JoinAudioObservation,
): JoinAudioOutcome | null {
  const {
    joinCompleted,
    playbackMuted,
    producersAnnounced,
    audioAdvanced,
    checkpoint,
  } = observation;

  // 1. A join that never completed has no audio to grade, and it is a fault
  //    that already has its own reporting. Must not be folded into `silent`.
  if (!joinCompleted) return 'join-failed';

  // 2. Evidence of flow beats every other consideration, including mute.
  //    An element at `volume = 0` is not paused — its `currentTime` still
  //    advances — so a muted user whose audio is arriving is genuinely
  //    `flowing`, and saying so is more truthful than declining to grade.
  if (audioAdvanced) return checkpoint === 'deadline' ? 'flowing' : 'flowing-late';

  // 3. AC: a user who muted their own playback is NEVER counted as a silent
  //    join. Checked before `idle` so the more specific reason wins.
  if (playbackMuted) return 'playback-muted';

  // 4. Nothing was announced, so there was nothing to hear. This is the case
  //    that would otherwise dominate the metric — most joins land in a room
  //    where nobody happens to be speaking, and grading those as silent would
  //    bury the real fault under noise.
  if (producersAnnounced === 0) return 'idle';

  // 5. Announced, not flowing, deadline not yet past its extension: undecided.
  //    Keep watching rather than accusing.
  if (checkpoint === 'deadline') return null;

  // 6. Announced, and still nothing after the extension. The fault.
  return 'silent';
}

/**
 * Whether an outcome is the fault this instrument exists to count.
 *
 * A single predicate so the caller cannot drift from the rule — the set of
 * "bad" outcomes is decided here, not at the reporting site.
 */
export function isSilentJoin(outcome: JoinAudioOutcome): boolean {
  return outcome === 'silent';
}

/**
 * Whether an outcome is worth reporting at all.
 *
 * `idle` and `playback-muted` are excluded: they are not observations about the
 * service, and reporting them would spend event volume on the two most common
 * states in the app. `flowing` is excluded for the same reason — a healthy join
 * is the overwhelming majority, and the denominator it would provide is not
 * worth the cost. What remains is the fault and its near miss.
 */
export function isReportableJoinOutcome(outcome: JoinAudioOutcome): boolean {
  return outcome === 'silent' || outcome === 'flowing-late' || outcome === 'join-failed';
}

/**
 * Where a silent join broke, as a low-cardinality tag value.
 *
 * The distinction is the diagnostic payload: `never-consumed` means the
 * announcement never became a consumer — signalling, an ack, or one of
 * `consumeProducer`'s silent early returns. `no-media` means consumers exist
 * and no bytes arrived — a transport or network fault. Those are different
 * bugs, and a single `silent` count cannot tell them apart.
 */
export function silentJoinStage(observation: {
  producersAnnounced: number;
  consumersCreated: number;
}): 'never-consumed' | 'partially-consumed' | 'no-media' {
  if (observation.consumersCreated === 0) return 'never-consumed';
  if (observation.consumersCreated < observation.producersAnnounced) {
    return 'partially-consumed';
  }
  return 'no-media';
}
