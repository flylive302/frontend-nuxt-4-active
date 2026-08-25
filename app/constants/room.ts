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

/**
 * Page size for the room's admin roster (`GET /rooms/{id}/members?role=admin`).
 *
 * Moderation UI needs a target's rank, and the paginated members list only
 * holds the pages already scrolled. Admins per room are a handful, so the
 * roster is fetched whole in one page rather than walked with a cursor.
 */
export const ADMIN_ROSTER_PAGE_SIZE = 100;

/**
 * Max seats allowed to run a LIVE animated avatar-frame concurrently
 * (room-battery-perf/02). Active speakers get priority; seats over budget
 * render the cached still-frame instead.
 */
export const FRAME_ANIMATION_BUDGET = 15;

// ============================================
// Home Feed
// ============================================

/**
 * Page size of the home rooms feed (home-room-feed/10).
 *
 * Sent explicitly as `per_page` on every home rooms request (page 1 via the
 * cached BFF route, page 2+ via `useRoom().fetchRooms`), so the wire value is
 * this one and not a coincidental match with `RoomFilterDTO`'s default.
 *
 * ⚠️ Do not retune casually: the carousel/grid split (`HOME_CAROUSEL_ROOM_COUNT`
 * skimmed off page 1) and `evaluateHasMore`'s fallback arithmetic are tuned
 * around 15. Backend clamps `per_page` to 1–100 (`ListRoomsRequest`).
 */
export const HOME_ROOMS_PER_PAGE = 15;

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
 * How many of a join snapshot's existing producers are re-consumed at once
 * (aws-app-affinity/04).
 *
 * The catch-up loop used to be strictly serial, so a rejoin cost
 * `3 + 2×(N−1)` *sequential* round trips at `SOCKET_TIMEOUT_MS` each, all
 * inside the `ROOM_OP_TIMEOUT_MS` backstop above. Two producers timing out
 * back-to-back therefore exhausted the whole budget before a room was half
 * recovered, and the rejoin was abandoned — on every reconnect, not just
 * affinity moves.
 *
 * Sized against real rooms rather than a round number: seats run
 * `MIN_SEAT_COUNT`(5) → `MAX_SEAT_COUNT`(30), default `DEFAULT_SEAT_COUNT`(15).
 * At 4, a full default room recovers in 4 rounds instead of 15, and at most 4
 * producers can be burning a 10 s timeout at the same time.
 *
 * ⚠️ Bounded on purpose — do not raise this to "just do them all". An
 * unbounded burst on a 30-seat room fires 30 simultaneous socket emits into a
 * link that is, by definition of a reconnect, already unhealthy; that turns a
 * slow recovery into a self-inflicted timeout storm.
 */
export const ROOM_RECONSUME_CONCURRENCY = 4;

/**
 * How often the active-room marker's heartbeat is refreshed while the user sits
 * in a room. The marker is what lets a reloaded page tell "I was in this room a
 * moment ago" from "I opened this link cold", so it must be recent enough to be
 * trustworthy and cheap enough to write on an interval.
 */
export const ACTIVE_ROOM_HEARTBEAT_MS = 5_000;

/**
 * How stale the active-room marker may be and still authorise an automatic
 * rehydrate. Must exceed ACTIVE_ROOM_HEARTBEAT_MS by enough to cover a slow
 * reload on low-end Android (app boot + socket connect + join), but stay short
 * enough that a marker can never outlive the session that wrote it — otherwise
 * a day-old marker would silently auto-join a room from a shared link, which is
 * the behaviour the marker-driven design exists to prevent.
 */
export const ACTIVE_ROOM_MARKER_TTL_MS = 60_000;

/**
 * Exponential backoff for automatic room-audio rebuild retries after a failed
 * reconnect/rebuild (base doubles per attempt, capped). Retries continue until
 * the rebuild succeeds or the user leaves the room — a transient failure (e.g.
 * network still down when the tab resumed) must never become a permanent
 * chat-only dead-end.
 */
export const AUDIO_REBUILD_RETRY_BASE_MS = 2_000;
export const AUDIO_REBUILD_RETRY_MAX_MS = 30_000;

/**
 * Transport-recovery-exhausted auto-rebuild budget (audio-pipe-observability 10).
 * When a mediasoup transport dies while the socket stays healthy, recovery is
 * wired into the same rebuild path as the socket-failed case — but that rebuild
 * resolves on transport *creation*, not connection. For the `attempts-exhausted`
 * half (client network / TURN unreachable) a fresh transport re-fails ICE, so an
 * unbounded auto-rebuild would loop: churn the socket, flicker seats, and emit a
 * fresh Sentry event every cycle. Cap auto-rebuilds to one per cooldown window;
 * further exhaustions inside the window settle straight to the manual "Reconnect"
 * affordance. The window is measured from the previous exhaustion's *handling
 * completion*, so it captures how long the fresh transport actually survived —
 * and self-resets once audio has been healthy for a full window.
 *
 * Cooldown is set well above the recovery engine's worst-case cycle-to-exhaustion
 * (grace 2s + 3 attempts × [backoff 1/2/4s + ICE round-trip + browser ICE-fail
 * detection] ≈ 25–45s), so a genuinely broken path always re-fails *inside* the
 * window and hits the affordance rather than earning a second auto-rebuild.
 */
export const TRANSPORT_REBUILD_MAX_AUTO = 1;
export const TRANSPORT_REBUILD_COOLDOWN_MS = 120_000;

/**
 * Re-pin budget, stated per speaker count (aws-production 21).
 *
 * When a Room is moved to a different instance (drain or health failure — the
 * exhaustive trigger list, see `utils/room-repin.ts`), the client tears down
 * and rejoins at the new address. The audio-gap budget scales with the number
 * of producers to re-consume, against the post-affinity-04 CONCURRENT consume
 * shape (`ROOM_RECONSUME_CONCURRENCY` at a time), not the old serial one:
 *
 *   budget(N) = REPIN_BASE_BUDGET_MS
 *             + ceil(N / ROOM_RECONSUME_CONCURRENCY) × REPIN_CONSUME_BATCH_BUDGET_MS
 *
 * Base covers socket teardown + connect + join ack (each inner deadline is
 * 10 s, but a healthy target instance answers in well under that — the base is
 * a budget for the healthy path, not a sum of worst cases). Each consume batch
 * adds one nominal round-trip window. A blown budget SURFACES with a retry
 * affordance; it must not disappear into the unbounded rebuild backoff.
 *
 * ⚠️ The old ~9 s figure floating around is the ICE-restart budget for an
 * already-connected transport — it is NOT a measurement of reconnecting to a
 * different address and must not be cited as this budget's source.
 */
export const REPIN_BASE_BUDGET_MS = 15_000;
export const REPIN_CONSUME_BATCH_BUDGET_MS = 5_000;

/**
 * Toast id for the reconnect-failed banner, so a later successful rebuild can
 * dismiss it by id and the socket-failed / transport-exhausted / blown-repin
 * paths can never stack banners.
 */
export const RECONNECT_FAILED_TOAST_ID = 'audio-reconnect-failed';

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
// Room Logo
// ============================================

/**
 * Crop aspect ratio offered when uploading a room logo (create + theme drawer).
 *
 * The logo is the room CARD's main image, so it is cropped to the card box
 * rather than to a square. 5:6 is the carousel cell (`max-w-60 h-72`); the
 * grid cell is the slightly taller 5:7 and `object-cover` absorbs the
 * difference. 5:6 over 5:7 on purpose — it is the nearer of the two to square,
 * so the pre-existing 1:1 logos (never migrated) degrade least beside it, and
 * it is the ratio of the LCP surface.
 *
 * The circular surfaces (room header, ranking rows, minimized bubble) stay
 * square by asking the CDN to center-crop — see `roomLogoSquareSrc`.
 */
export const ROOM_LOGO_ASPECT_RATIO = 5 / 6;

/** Rendered CSS width of the owner-avatar chip on a room card (`size-6`), x~2.6 DPR. */
export const ROOM_CARD_OWNER_AVATAR_WIDTH = 64;

// ============================================
// Limits
// ============================================

/** Maximum chat messages to keep in memory */
export const MAX_CHAT_MESSAGES = 500;

/** Chat message type for locally-synthesized system bubbles (membership events, etc). */
export const CHAT_MESSAGE_TYPE_SYSTEM = 'system';

/**
 * Chat message type for locally-synthesized gift-sent announcement bubbles
 * (lucky-burst-draw ticket 10). Doubles as the update-in-place discriminator
 * for combo-streak patching.
 */
export const CHAT_MESSAGE_TYPE_GIFT = 'gift';

/**
 * Chat message type for locally-synthesized lucky-win announcement bubbles
 * (lucky-burst-draw ticket 10).
 */
export const CHAT_MESSAGE_TYPE_LUCKY_WIN = 'lucky-win';

/** Chat message type for a real user-typed message (see useRoomChat.sendChatMessage's default). */
export const CHAT_MESSAGE_TYPE_TEXT = 'text';

// ============================================
// Chat filter tabs (lucky-burst-draw ticket 10 follow-up)
// ============================================

/** Shows every message regardless of type. */
export const CHAT_TAB_ALL = 'all';
/** Shows only real user-typed messages (`CHAT_MESSAGE_TYPE_TEXT`). */
export const CHAT_TAB_CHAT = 'chat';
/** Shows only locally-synthesized announcement bubbles (system/gift/lucky-win — every non-text type). */
export const CHAT_TAB_GIFTS = 'gifts';

export type ChatTab = typeof CHAT_TAB_ALL | typeof CHAT_TAB_CHAT | typeof CHAT_TAB_GIFTS;

/**
 * Maximum number of tracks the DJ's Playlist queue holds. Adds beyond this are
 * ignored (the existing queue keeps playing). Bounds the session-local list;
 * memory is bounded separately by the engine's lazy-decode (ADR 0006).
 */
export const PLAYLIST_MAX_TRACKS = 50;

/**
 * Talk-over duck (ADR 0018): holding the player vinyl ramps the music gain
 * down, for the Room and the DJ's own monitor alike (one gain feeds both
 * edges). The target fraction is user-configurable — see
 * `stores/audioPreferences.ts` (`duckLevelPercent`) and
 * `utils/audio/duck-level.ts` (`percentToFraction`).
 */

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




// ============================================

// ---- Audio transport recovery (msab-load-stability 10) ----
// A transport `failed` used to be terminal (toast + leave/rejoin the only
// cure). Recovery attempts bounded ICE restarts before declaring failure.

/** How long a `disconnected` state may persist before an ICE restart is attempted. */
export const TRANSPORT_DISCONNECTED_GRACE_MS = 2_000;

/** Max ICE-restart attempts per outage before recovery is declared exhausted. */
export const TRANSPORT_RECOVERY_MAX_ATTEMPTS = 3;

/** Backoff before each successive restart attempt (index = attempt - 1). */
export const TRANSPORT_RECOVERY_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

// ---- Speaking indicator (svga-removal 01) ----

/**
 * Fallback ring color for the active-speaker CSS pulse when the equipped
 * mice-wave prop has no valid `metadata.color` (missing, malformed, or not
 * yet resolved from `propIndex`). See `~/utils/mice-wave-ring-color`.
 */
export const DEFAULT_SPEAKING_RING_COLOR = '#f97316';

/**
 * Minimum gap between `user:profileSync` emits driven by balance.updated.
 * A gift combo updates the balance per tap; other participants only need the
 * resulting XP a few times a second, not hundreds. Trailing-edge, so the final
 * value always goes out.
 */
export const PROFILE_SYNC_THROTTLE_MS = 500;
