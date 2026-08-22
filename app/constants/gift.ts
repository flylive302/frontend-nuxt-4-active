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
 * Max lucky fly animations on screen at once. Each fly is a 2 s Web Animation on
 * its own <img>, and each trigger forces two synchronous layouts
 * (`getBoundingClientRect` for sender + recipient). Before this cap a 500-tap
 * lucky combo into a 3-seat room queued ~1,500 concurrent animations and
 * jammed a low-end phone's main thread for over a minute — long enough to miss
 * the Socket.IO heartbeat and be dropped from the seat (prod 2026-08-23:
 * "ping timeout" with giftSendCount 502). Over the cap, flies are dropped —
 * the visual is decorative; the win/balance path never touches it.
 */
export const LUCKY_FLY_MAX_CONCURRENT = 6;

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

/**
 * Combo-tap coalescing window, in milliseconds (msab-load-stability — combo
 * tap flood). Rapid combo/lucky-combo taps within this window merge into ONE
 * `gift:send` emit with a summed quantity instead of one emit per tap — on
 * low-end phones, 100-200 taps/sec of raw emits jams the main thread and drops
 * the socket to server ping timeouts. Optimistic coin debit and the visual
 * combo counter still happen per tap; only the network emit and its refund
 * tracking are batched. See `useGiftSending.ts`.
 */
export const GIFT_COMBO_COALESCE_MS = 300;

/**
 * Hard cap on the summed `quantity` a coalesced combo burst may reach before
 * it is force-flushed and a new burst starts. Mirrors MSAB's wire-level cap
 * (`src/socket/schemas.ts`: `quantity: z.number().int().positive().max(9999)`)
 * — without this, a long tap run at the top quantity option (177) would
 * exceed the cap after ~57 taps and the whole merged burst would bounce as
 * `Invalid payload` instead of just being split into two emits.
 */
export const GIFT_COMBO_MAX_BURST_QUANTITY = 9999;
