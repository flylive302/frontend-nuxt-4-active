// ========================================
// Coins page (/coins/request) constants
// ========================================

/**
 * The official web coin shop (repo `portal-nuxt`, CF Worker `payment-portal-flylive`).
 * Web-only: never link to it from the native shells — Apple 3.1.1 and Google
 * Play's payments policy both forbid steering users to an outside purchase.
 */
export const RECHARGE_PORTAL_URL = 'https://flyliverecharge.com/'

/** Display form of `RECHARGE_PORTAL_URL` for copy. */
export const RECHARGE_PORTAL_HOST = 'flyliverecharge.com'

/** Balance count-up duration on the coins page, in ms. */
export const BALANCE_COUNT_UP_MS = 700

/** How long the "Copied" state stays on the copy-ID button, in ms. */
export const COPY_CONFIRM_MS = 1500
