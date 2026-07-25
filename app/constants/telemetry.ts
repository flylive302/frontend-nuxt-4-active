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
