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

// ============================================
// Thread View (dm-messenger-v2/07)
// ============================================

/**
 * Max gap between two consecutive same-sender messages that still counts as
 * the same visual cluster (tight grouping — single timestamp/tick per
 * cluster). A longer gap starts a new group even for the same sender.
 */
export const MESSAGE_GROUP_MAX_GAP_MS = 5 * 60 * 1000

/**
 * Distance (px) from the bottom of the scroll container beyond which the
 * thread is considered "scrolled up" — surfaces the scroll-to-bottom pill.
 */
export const SCROLL_TO_BOTTOM_THRESHOLD_PX = 120

// ============================================
// DM Image Attachments (dm-messenger-v2/01)
// ============================================

/** Long-edge cap (px) for client-side canvas downscale before upload. */
export const DM_IMAGE_DOWNSCALE_LONG_EDGE_PX = 1600

/** Post-compression size cap, bytes — must match the backend finalize cap. */
export const DM_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Server-enforced mime allow-list — must match DmAttachmentService. */
export const DM_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** JPEG quality used when re-encoding the downscaled canvas. */
export const DM_IMAGE_COMPRESS_QUALITY = 0.85

// ============================================
// DM Composer State Machine (dm-messenger-v2/02)
// ============================================

/** Composer machine states — one active at a time (`recording` added dm-messenger-v2/04). */
export const DM_COMPOSER_STATES = ['idle', 'picking', 'recording', 'uploading', 'sending'] as const

// ============================================
// Image Lightbox (dm-messenger-v2/03)
// ============================================

/** Vertical drag distance (px) past which a swipe-down dismisses the lightbox. */
export const LIGHTBOX_SWIPE_DISMISS_THRESHOLD_PX = 100

/** Max ms between two taps for the second one to count as a double-tap. */
export const LIGHTBOX_DOUBLE_TAP_WINDOW_MS = 300

// ============================================
// DM Voice Notes (dm-messenger-v2/04)
// ============================================

/** Voice note size cap, bytes — must match the backend finalizeVoice cap. */
export const DM_VOICE_MAX_BYTES = 2 * 1024 * 1024

/** Voice note duration cap, ms — must match the backend finalizeVoice cap. */
export const DM_VOICE_MAX_DURATION_MS = 120_000

/**
 * MediaRecorder mime candidates in preference order — opus in WebM (Chrome/
 * Android), opus in Ogg (desktop Firefox), MP4/AAC fallback (Safari/iOS
 * WebView, which does not support WebM). Must stay in sync with
 * DmAttachmentService::ALLOWED_VOICE_MIME_TYPES on the backend.
 */
export const DM_VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const

/** Horizontal slide distance (px) past which hold-to-record cancels. */
export const VOICE_SLIDE_TO_CANCEL_THRESHOLD_PX = 80

// ============================================
// DM Voice Playback (dm-messenger-v2/05)
// ============================================

/** Number of static waveform bars rendered per voice note bubble. */
export const VOICE_WAVEFORM_BAR_COUNT = 28

/** Shortest waveform bar height, px. */
export const VOICE_WAVEFORM_BAR_MIN_HEIGHT_PX = 4

/** Tallest waveform bar height, px. */
export const VOICE_WAVEFORM_BAR_MAX_HEIGHT_PX = 20

/** Playback speeds the speed-toggle chip cycles through, in order. */
export const VOICE_PLAYBACK_RATES = [1, 1.5, 2] as const

