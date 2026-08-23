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
export const MAX_PLAYBACK_QUEUE_SIZE = 30;

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
export const LUCKY_FLY_THUMBNAIL_SIZE = 58;

/**
 * Lucky flies render on ONE canvas (see `services/luckyFlyRenderer.ts`), so
 * there is no concurrency cap and nothing is ever dropped — every tap flies.
 * Before the canvas, each fly was its own <img> + Web Animation + two forced
 * layouts; a 500-tap combo into a 3-seat room jammed a low-end phone for over
 * a minute and it missed the Socket.IO heartbeat (prod 2026-08-23, "ping
 * timeout" with giftSendCount 502). The stream below is how a burst is paced.
 */

/** Gap between consecutive fly launches so a burst reads as a stream, not a blob. */
export const LUCKY_FLY_STAGGER_MS = 40;

/**
 * Longest a launch backlog may take to drain. Past this the stagger shrinks
 * (launches compress) so a 1,000-leg burst still finishes in bounded time.
 * Compress — never drop.
 */
export const LUCKY_FLY_MAX_STREAM_MS = 8000;

/** Random path offset per fly (px) so stacked flies are visibly distinct. */
export const LUCKY_FLY_PATH_JITTER_PX = 14;

/**
 * Seat screen positions are cached this long. Measuring a seat forces a
 * layout, so a burst must not measure per leg — one measure per seat per TTL.
 */
export const LUCKY_FLY_SEAT_CACHE_TTL_MS = 1000;

/** Canvas backing-store DPR cap — 3x phones gain nothing visible and pay 2.25x fill. */
export const LUCKY_FLY_MAX_DPR = 2;

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
export const GIFT_FAILURE_TOAST_COOLDOWN_MS = 2000;

/**
 * Combo-tap coalescing window, in milliseconds (msab-load-stability — combo
 * tap flood). Rapid combo/lucky-combo taps within this window merge into ONE
 * `gift:send` emit with a summed quantity instead of one emit per tap — on
 * low-end phones, 100-200 taps/sec of raw emits jams the main thread and drops
 * the socket to server ping timeouts. Optimistic coin debit and the visual
 * combo counter still happen per tap; only the network emit and its refund
 * tracking are batched. See `useGiftSending.ts`.
 */
export const GIFT_COMBO_COALESCE_MS = 600;

/**
 * Hard cap on the summed `quantity` a coalesced combo burst may reach before
 * it is force-flushed and a new burst starts. Mirrors MSAB's wire-level cap
 * (`src/socket/schemas.ts`: `quantity: z.number().int().positive().max(9999)`)
 * — without this, a long tap run at the top quantity option (177) would
 * exceed the cap after ~57 taps and the whole merged burst would bounce as
 * `Invalid payload` instead of just being split into two emits.
 */
export const GIFT_COMBO_MAX_BURST_QUANTITY = 9999;
