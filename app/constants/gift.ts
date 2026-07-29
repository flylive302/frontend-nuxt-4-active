/**
 * Gift System Constants
 *
 * Centralized configuration for gift-related features.
 */

/** Available quantity options for sending gifts */
export const GIFT_QUANTITY_OPTIONS = [1, 7, 17, 77, 177] as const;

/** Duration to display static image gifts (in milliseconds) */
export const STATIC_DISPLAY_DURATION_MS = 3000;

/** Time before combo button hides after last interaction (in milliseconds) */
export const COMBO_BUTTON_TIMEOUT_MS = 5000;

/** Maximum number of gifts in the playback queue (drop-oldest beyond this) */
export const MAX_PLAYBACK_QUEUE_SIZE = 50;

/**
 * Backlog depth at which burst-mode load-shedding activates (msab-load-stability
 * 11). Below this the queue behaves as today. At/above it, non-critical gifts
 * are shed (not queued) instead of piling up — balances/XP are already booked
 * by the caller before enqueue, so shedding here only skips the full-screen
 * animation, keeping main-thread decode/render work bounded during a burst.
 * Critical gifts (`gift.is_critical`) always play regardless of backlog.
 */
export const BURST_SHED_QUEUE_DEPTH = 12;

// Main-thread stall thresholds used to live here, from when the monitor was
// believed to be a gift instrument. It observes every route, so its tuning now
// sits with the other measurement constants in `constants/telemetry.ts`.

/** Maximum ×N repeats a coalesced identical-gift run can accumulate */
export const MAX_PLAYBACK_REPEATS = 99;

/** Maximum blob URLs kept in the in-memory video cache (LRU eviction + revoke) */
export const VIDEO_CACHE_MAX_ENTRIES = 20;

/** Stall window for gift playback (in milliseconds): force-advances the queue only
 * after this long with NO `progress` heartbeat from the active player. Healthy
 * playback of any duration re-arms the timer, so long animations are never cut off.
 * Error paths advance the queue instantly (player emits `ended` on failure). */
export const GIFT_PLAYBACK_TIMEOUT_MS = 8000;

/** Default gift category to show when drawer opens */
export const DEFAULT_GIFT_CATEGORY = 'normal' as const;

/** Duration of lucky gift fly animation in milliseconds (sender → center → receiver) */
export const LUCKY_FLY_DURATION_MS = 2000;

/** Size of the lucky gift fly thumbnail in pixels */
export const LUCKY_FLY_THUMBNAIL_SIZE = 64;

/**
 * `gift:send` ack failure messages, copied verbatim from the audio server's
 * `src/shared/errors.ts`. MSAB acks with the literal message, not a code, so
 * these strings ARE the contract — if one is renamed there, the matching arm in
 * `useGiftSending` silently falls through to the generic message.
 */
export const GIFT_SEND_ERROR = {
  NO_RECIPIENTS_SEATED: 'No recipients seated',
  NOT_IN_ROOM: 'Not in room',
  RATE_LIMITED: 'Too many requests',
  INVALID_PAYLOAD: 'Invalid payload',
} as const;

/**
 * Minimum gap between two "gift not sent" toasts, in milliseconds.
 *
 * A combo is one emit per tap, so a rejected combo fails once per tap — twenty
 * taps against an empty seat produced twenty identical refunds. The operator
 * needs to be told once, not twenty times; this keeps the same anti-spam
 * posture as the deliberately-silent partial-drop refund below it.
 */
export const GIFT_FAILURE_TOAST_COOLDOWN_MS = 4000;
