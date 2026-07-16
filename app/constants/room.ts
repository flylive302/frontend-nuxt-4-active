/**
 * Room System Constants
 *
 * Centralized configuration for room-related features.
 * Use these constants instead of magic numbers throughout the codebase.
 */

// ============================================
// Seat Configuration
// ============================================

/**
 * Default speaker-seat count — the fallback used before a room's authoritative
 * `max_seats` is known (join snapshot / room.updated). Rooms are per-Room
 * selectable between MIN_SEAT_COUNT and MAX_SEAT_COUNT (realtime-12).
 */
export const DEFAULT_SEAT_COUNT = 15;

/** Minimum per-Room seat count (Laravel-authoritative). */
export const MIN_SEAT_COUNT = 5;

/** Maximum per-Room seat count (Laravel-authoritative; room-seat-caps Seat Unlock Ladder tops out at level 10). */
export const MAX_SEAT_COUNT = 30;

/** Seat counts are selectable in steps of this size (5, 10, 15, ..., 30). */
export const SEAT_COUNT_STEP = 5;

// ============================================
// Room Theme
// ============================================

/** Selectable room theme colors (Room Settings → Theme). */
export const ROOM_THEME_COLORS = [
  { label: 'Rose', value: '#e11d48' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Neon Green', value: '#22c55e' },
  { label: 'Hot Magenta', value: '#e11de1' },
  { label: 'Sunset Coral', value: '#ff6b6b' },
  { label: 'Lavender', value: '#a78bfa' },
  { label: 'Turquoise', value: '#14b8a6' },
  { label: 'Electric Lime', value: '#a3e635' },
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Fuchsia', value: '#d946ef' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
] as const;

// ============================================
// Timeouts
// ============================================

/** Socket operation timeout in milliseconds */
export const SOCKET_TIMEOUT_MS = 10_000;

/** Connection wait timeout in milliseconds */
export const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Backstop ceiling for a full room join / rebuild operation, in milliseconds.
 * Sits above the inner 10s deadlines (connect wait + socket acks) so it only
 * fires if some await never settles — guaranteeing the lifecycle `isJoining` /
 * `isRecovering` flags always reset rather than wedging future joins.
 */
export const ROOM_OP_TIMEOUT_MS = 30_000;

/**
 * Exponential backoff for automatic room-audio rebuild retries after a failed
 * reconnect/rebuild (base doubles per attempt, capped). Retries continue until
 * the rebuild succeeds or the user leaves the room — a transient failure (e.g.
 * network still down when the tab resumed) must never become a permanent
 * chat-only dead-end.
 */
export const AUDIO_REBUILD_RETRY_BASE_MS = 2_000;
export const AUDIO_REBUILD_RETRY_MAX_MS = 30_000;

// ============================================
// Chat
// ============================================

/**
 * Distance (px) from the bottom of the chat scroller within which the view
 * counts as "pinned" — sticky auto-scroll stays engaged while inside this
 * threshold and re-engages once the user scrolls back within it.
 */
export const CHAT_STICKY_BOTTOM_THRESHOLD_PX = 80;

/** Body scroll unlock delay in milliseconds */
export const BODY_UNLOCK_DELAY_MS = 1_000;

// ============================================
// Background Image
// ============================================

/** Rendered width requested from ImageKit for the full-screen room background. */
export const ROOM_BACKGROUND_WIDTH = 960;

/** Compression quality for the full-screen room background. */
export const ROOM_BACKGROUND_QUALITY = 75;

// ============================================
// Limits
// ============================================

/** Maximum chat messages to keep in memory */
export const MAX_CHAT_MESSAGES = 500;

/**
 * Maximum number of tracks the DJ's Playlist queue holds. Adds beyond this are
 * ignored (the existing queue keeps playing). Bounds the session-local list;
 * memory is bounded separately by the engine's lazy-decode (ADR 0006).
 */
export const PLAYLIST_MAX_TRACKS = 50;

/**
 * Talk-over duck (ADR 0018): holding the player vinyl ramps the music gain
 * down to this fraction of its current effective volume, for the Room and
 * the DJ's own monitor alike (one gain feeds both edges).
 */
export const AUDIO_DUCK_FRACTION = 0.2;

/** Gain ramp duration (ms) when the duck engages (hold-start). */
export const AUDIO_DUCK_RAMP_DOWN_MS = 150;

/** Gain ramp duration (ms) when the duck releases (hold-end), restoring volume. */
export const AUDIO_DUCK_RAMP_UP_MS = 400;

/**
 * Pointer-hold duration (ms) past which a press on the player vinyl is a
 * `hold` (duck) rather than a `tap` (expand). See `useHoldGesture`.
 */
export const HOLD_GESTURE_THRESHOLD_MS = 250;

/**
 * Active-speaker decay TTL (ms). MSAB only emits `speaker:active` while
 * someone is talking (mediasoup's ActiveSpeakerObserver has no silence
 * event), so the client clears the speaking indicators locally this long
 * after the last event. Fresh events keep resetting the timer, so it never
 * fires during continuous speech.
 */
export const SPEAKER_ACTIVE_TTL_MS = 2_000;

// ============================================
// Gift Economy
// ============================================

/**
 * Split-base fraction of a LUCKY gift's coin value (GCV) — the portion split the
 * normal way and surfaced in the seat total.
 *
 * The 🪙 "gifts received" total under a seated user's avatar shows the lucky
 * split base, not the full GCV — lucky gifts route most of their value to the
 * lucky pool, so only this fraction is split the normal way. Other categories
 * credit the full GCV.
 *
 * COUPLED to the backend setting `gift.lucky_split_percentage` (default
 * 10.00 → 0.10). If that setting changes, update this constant to match, or the
 * displayed seat total will diverge from the backend split base.
 */
export const LUCKY_SPLIT_SHARE = 0.1;

// ============================================
// Debounce Delays
// ============================================

/** Debounce delay for gift preload trigger in milliseconds */
export const GIFT_PRELOAD_DEBOUNCE_MS = 300;

// ============================================
// Room Blocks (kick duration)
// ============================================

/**
 * Canonical block/kick durations, mirroring the backend `BlockDuration` enum
 * (ADR 0017). Every kick MUST carry one of these — there is no duration-less
 * kick. Order matches the duration popup's display order.
 */
export const BLOCK_DURATIONS = [
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '8h', label: '8 hours' },
  { value: '24h', label: '24 hours' },
  { value: 'permanent', label: 'Block permanently' },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type BlockDurationValue = (typeof BLOCK_DURATIONS)[number]['value'];

// ============================================
// Slide Overlay
// ============================================

// ---- SlideQueue overlap engine (tunable, mobile-conservative) ----
// All back-pressure limits are injected into `SlideQueue` (never hardcoded in
// the engine) so they can be tuned without touching the pure model. Defaults
// favour mobile per the mobile-first priority. See ADR 0009.

/** Freshness TTL (ms): a queued slide that has waited longer is expired and never plays. */
export const SLIDE_QUEUE_TTL_MS = 8_000;

/** Max queued slides per vertical band; the oldest low-priority item beyond this is dropped. */
export const SLIDE_QUEUE_PER_BAND_DEPTH = 3;

/** Max slides playing at once on mobile (across all bands). */
export const SLIDE_QUEUE_GLOBAL_CAP_MOBILE = 3;

/** Max slides playing at once on desktop (across all bands). */
export const SLIDE_QUEUE_GLOBAL_CAP_DESKTOP = 5;

/** Repeated (slide, sender, recipient) within this window coalesce into one item with a count. */
export const SLIDE_QUEUE_COALESCE_WINDOW_MS = 2_500;

/** Min viewport width (px) treated as desktop when resolving the global concurrent cap. */
export const SLIDE_QUEUE_DESKTOP_MIN_WIDTH_PX = 768;

/** How often the overlay composable ticks the queue to expire stale waiters. */
export const SLIDE_QUEUE_TICK_INTERVAL_MS = 1_000;



