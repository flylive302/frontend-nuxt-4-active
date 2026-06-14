/**
 * Gift System Constants
 *
 * Centralized configuration for gift-related features.
 */

/** Available quantity options for sending gifts */
export const GIFT_QUANTITY_OPTIONS = [1, 7, 17, 77, 777, 1777] as const;

/** Duration to display static image gifts (in milliseconds) */
export const STATIC_DISPLAY_DURATION_MS = 3000;

/** Time before combo button hides after last interaction (in milliseconds) */
export const COMBO_BUTTON_TIMEOUT_MS = 5000;

/** Maximum number of gifts in the playback queue */
export const MAX_PLAYBACK_QUEUE_SIZE = 10000;

/** Minimum interval between outgoing gift socket messages (in milliseconds) */
export const GIFT_QUEUE_INTERVAL_MS = 100;

/** Maximum time to wait for a gift animation to complete before force-closing (in milliseconds) */
export const GIFT_PLAYBACK_TIMEOUT_MS = 30000;

/** Default gift category to show when drawer opens */
export const DEFAULT_GIFT_CATEGORY = 'normal' as const;

/** Duration of lucky gift fly animation in milliseconds (sender → center → receiver) */
export const LUCKY_FLY_DURATION_MS = 2000;

/** Size of the lucky gift fly thumbnail in pixels */
export const LUCKY_FLY_THUMBNAIL_SIZE = 64;
