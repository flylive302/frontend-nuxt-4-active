// ========================================
// IAP Constants
// ========================================
// Static values and configuration for the native "Buy Coins" flow.
// No imports from stores or composables.
// ========================================

/** Max items per `POST /iap/{store}/restore` call — backend limit is 1..20. */
export const IAP_RESTORE_BATCH_SIZE = 20

/**
 * Max transactions one restore run submits (two calls). A reinstall on iOS 18+
 * lists the whole consumable history; it converges over a few runs instead of
 * tripping `throttle:iap` (20/min per user, shared with verify).
 */
export const IAP_RESTORE_MAX_PER_RUN = 40

/** localStorage key of the device's purchase journal (`services/iap/purchase-journal.ts`). Bump the suffix on a shape change. */
export const IAP_JOURNAL_STORAGE_KEY = 'flylive.iap.journal.v1'

/** Unsettled purchases kept per device — far above any real backlog; the oldest go first. */
export const IAP_JOURNAL_MAX_ENTRIES = 50

/** An unsettled purchase older than this is dropped (and logged); past it only admin Re-verify can help. */
export const IAP_JOURNAL_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/** Settled transaction ids remembered so restore skips them (iOS 18+ lists every finished consumable). */
export const IAP_JOURNAL_MAX_SETTLED = 2000
