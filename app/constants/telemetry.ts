// ========================================
// Reload telemetry
// ========================================
//
// Tuning for `utils/reload-telemetry.ts`. Kept out of `constants/room.ts`
// deliberately: these bound a *measurement*, not room behaviour, and must be
// re-tunable without touching the rehydration path they observe.
// ========================================

/**
 * How long a recorded reload cause stays trustworthy.
 *
 * A reload takes 3–15s in practice. This matches `RELOAD_GUARD_WINDOW_MS` in
 * `plugins/chunk-reload.client.ts` so a marker can never outlive the reload it
 * describes and get mis-attributed to a later, unrelated boot.
 */
export const RELOAD_CAUSE_TTL_MS = 60_000;

/**
 * How long the in-room snapshot stays trustworthy as evidence of "the user was
 * in a room moments ago".
 *
 * Deliberately independent of `ACTIVE_ROOM_MARKER_TTL_MS` despite sharing its
 * value: that constant tunes whether rehydration *acts*, this one tunes whether
 * telemetry *believes*. Coupling them would let a rehydration tuning change
 * silently move the measurement.
 */
export const IN_ROOM_SNAPSHOT_TTL_MS = 60_000;

/**
 * How long the reporter waits for the post-reload outcome to settle before
 * recording `unknown`. Generous enough to cover rehydration's room fetch on a
 * slow mobile connection, short enough that a user who is ejected and manually
 * re-enters is unlikely to be miscounted as recovered.
 */
export const RELOAD_OUTCOME_TIMEOUT_MS = 10_000;

/** Longest error text carried on a record — enough to identify, not to bloat. */
export const RELOAD_DETAIL_MAX_CHARS = 300;

/**
 * Session-age buckets, ascending by upper bound. Bucketed rather than raw
 * because this rides a Sentry *tag*, and a tag with unbounded cardinality is
 * unqueryable. The exact millisecond value goes in `extra`.
 */
export const SESSION_AGE_BUCKETS: ReadonlyArray<{ maxMs: number; label: string }> = [
  { maxMs: 30_000, label: '<30s' },
  { maxMs: 120_000, label: '30s-2m' },
  { maxMs: 600_000, label: '2m-10m' },
  { maxMs: 3_600_000, label: '10m-1h' },
] as const;

/** Bucket label for anything past the last bound above. */
export const SESSION_AGE_OVERFLOW_LABEL = '>1h';

/** Bucket label when session age could not be determined. */
export const SESSION_AGE_UNKNOWN_LABEL = 'unknown';

// ========================================
// Device classification
// ========================================
// `navigator.deviceMemory` reports GB, rounded to a power of two (0.25 … 8),
// and is Chromium-only — which covers the Android WebView this app ships in.
// `hardwareConcurrency` is the cross-engine fallback.

/** `deviceMemory` at or below this (GB) is a low-end device. */
export const DEVICE_MEMORY_LOW_GB = 2;

/** `deviceMemory` at or below this (GB) is mid-tier; above it is high-end. */
export const DEVICE_MEMORY_MID_GB = 4;

/** `hardwareConcurrency` at or below this is a low-end device. */
export const DEVICE_CORES_LOW = 4;

/** `hardwareConcurrency` at or below this is mid-tier; above it is high-end. */
export const DEVICE_CORES_MID = 6;

// ========================================
// Main-thread stall telemetry
// ========================================
//
// Tuning for `utils/stall-telemetry.ts` + `services/stallMonitor.ts`. These used
// to live in `constants/gift.ts` back when the monitor was believed to be a
// gift-playback instrument. It is app-wide — it observes every route — so the
// tuning belongs with the other measurement constants, not inside one feature.

/**
 * Reportable stall thresholds (ms), by device tier.
 *
 * Reviewed 2026-07-26 against the real device mix (predominantly low-end to
 * mid-tier Android). The previous flat 200ms was set for a gift-burst freeze
 * that pinned the thread for 1–2 *minutes*; applied app-wide it also catches
 * ordinary boot hydration, which routinely exceeds 200ms on a 2GB Android and
 * is not a defect. That is the main reason the longtask issue accumulated
 * thousands of events without becoming actionable.
 *
 * Raising the floor per tier keeps the pathological stalls (the ones users feel
 * as a freeze) and drops the ordinary-hydration baseline. The applied value
 * rides every report as a tag so a volume change stays readable — a drop caused
 * by a fix and a drop caused by this retune must not look identical.
 */
export const STALL_THRESHOLD_LOW_MS = 500;

/** @see STALL_THRESHOLD_LOW_MS */
export const STALL_THRESHOLD_MID_MS = 350;

/** @see STALL_THRESHOLD_LOW_MS */
export const STALL_THRESHOLD_HIGH_MS = 250;

/**
 * Threshold when the tier cannot be read. Treated as mid rather than high:
 * `deviceMemory` is Chromium-only, so an unknown tier is more likely a device
 * the classifier could not see than a desktop.
 */
export const STALL_THRESHOLD_UNKNOWN_MS = STALL_THRESHOLD_MID_MS;

/**
 * Minimum interval between stall reports, applied **per lifecycle phase**.
 *
 * A single global bucket would let a cold-boot storm spend the only allowed
 * report and silently swallow every in-session stall for the next minute —
 * which is exactly the separation this instrument exists to provide. Per-phase
 * keys cost at most 3x the volume and keep the phases independent.
 */
export const STALL_REPORT_THROTTLE_MS = 60_000;

/**
 * How long after Vue app mount still counts as `hydration` rather than
 * `in-session`. Covers the first paint plus the bootstrap fetches that land
 * immediately after mount; past it, cost is steady-state and attributable to
 * whatever the user is doing.
 */
export const STALL_HYDRATION_SETTLE_MS = 3_000;

/**
 * How many route changes to retain for resolving "which route was active when
 * this entry started". `buffered: true` replays tasks from before the observer
 * existed, so the report time is not the entry time and the live route is not
 * necessarily the right answer.
 */
export const STALL_ROUTE_TIMELINE_MAX = 20;

/** Longest active-work label list carried on a tag — enough to point, not to bloat. */
export const STALL_ACTIVE_WORK_MAX = 4;

/** Longest attribution label carried on a tag. Keeps tag cardinality sane. */
export const STALL_ATTRIBUTION_MAX_CHARS = 80;

/**
 * Stall duration buckets, ascending by upper bound. Bucketed for the same
 * reason as `SESSION_AGE_BUCKETS`: this rides a tag. Raw ms goes in `extra`.
 */
export const STALL_DURATION_BUCKETS: ReadonlyArray<{ maxMs: number; label: string }> = [
  { maxMs: 500, label: '<500ms' },
  { maxMs: 1_000, label: '500ms-1s' },
  { maxMs: 3_000, label: '1s-3s' },
  { maxMs: 10_000, label: '3s-10s' },
] as const;

/** Bucket label for anything past the last bound above. */
export const STALL_DURATION_OVERFLOW_LABEL = '>10s';
