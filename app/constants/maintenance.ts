// ========================================
// Maintenance Wall Constants
// ========================================

/**
 * The single route reachable while the maintenance wall is up.
 *
 * Shared by `middleware/maintenance.global.ts` (the GATE that redirects here)
 * and `pages/maintenance.vue` (the page itself) so the two can never drift
 * into a redirect loop.
 *
 * No trailing slash — the middleware normalises `to.path` before comparing.
 */
export const MAINTENANCE_PATH = '/maintenance'

/** Support contact shown on the wall, where no in-app inbox is reachable. */
export const MAINTENANCE_SUPPORT_EMAIL = 'support@flylive.app'
