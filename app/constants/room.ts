/**
 * Room System Constants
 *
 * Centralized configuration for room-related features.
 * Use these constants instead of magic numbers throughout the codebase.
 */

// ============================================
// Seat Configuration
// ============================================

/** Total number of speaker seats in a room */
export const SEAT_COUNT = 15;

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

/** Body scroll unlock delay in milliseconds */
export const BODY_UNLOCK_DELAY_MS = 1_000;

// ============================================
// Limits
// ============================================

/** Maximum chat messages to keep in memory */
export const MAX_CHAT_MESSAGES = 500;

// ============================================
// Gift Economy
// ============================================

/**
 * Fraction of a LUCKY gift's coin value (GCV) actually credited to the receiver.
 *
 * The 🪙 "gifts received" total under a seated user's avatar must reflect what
 * the receiver is really credited, not the full GCV — lucky gifts route most of
 * their value to the platform / lucky pool, so only this share reaches the
 * receiver. Other categories credit the full GCV.
 *
 * COUPLED to the backend setting `gift.lucky_receiver_percentage` (default
 * 10.00 → 0.10). If that setting changes, update this constant to match, or the
 * displayed seat total will diverge from the credited amount.
 */
export const LUCKY_RECEIVER_SHARE = 0.1;

// ============================================
// Debounce Delays
// ============================================

/** Debounce delay for gift preload trigger in milliseconds */
export const GIFT_PRELOAD_DEBOUNCE_MS = 300;

// ============================================
// Slide Overlay
// ============================================

/** Top offset (px) for the slide overlay within the room view */
export const SLIDE_TOP_OFFSET_PX = 400;



