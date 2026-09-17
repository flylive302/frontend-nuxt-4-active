// ========================================
// IAP Constants
// ========================================
// Static values and configuration for the native "Buy Coins" flow.
// No imports from stores or composables.
// ========================================

/** Max items per `POST /iap/{store}/restore` call — backend limit is 1..20. */
export const IAP_RESTORE_BATCH_SIZE = 20
