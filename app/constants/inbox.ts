/**
 * Inbox / DM Constants
 *
 * Centralized configuration for inbox-related features.
 * Use these constants instead of magic numbers throughout the codebase.
 */

// ============================================
// Typing Indicator (dm-realtime-platform/04)
// ============================================

/**
 * Minimum interval between outgoing `dm:typing` emits while composing.
 * Must stay >= the MSAB rate-limit window
 * (RATE_LIMIT_TYPING_WINDOW_SECONDS, default 2s) so the client never gets
 * silently rate-limited under normal typing.
 */
export const TYPING_EMIT_THROTTLE_MS = 2000

/**
 * How long the receiving side keeps showing "is typing" after the last
 * signal before auto-clearing it.
 */
export const TYPING_INDICATOR_TIMEOUT_MS = 3000

// ============================================
// DM Presence (dm-realtime-platform/07)
// ============================================

/**
 * Max contact ids subscribed per socket via `presence:subscribe`. Must match
 * MSAB's PRESENCE_SUBSCRIBE_MAX cap — exceeding it fails the whole batch.
 */
export const PRESENCE_SUBSCRIBE_MAX = 50

